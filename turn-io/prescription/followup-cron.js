// Daily 09:50 IST reminder for patients whose follow-up date is today. Re-scans
// all follow-up obs every run -- nothing is scheduled ahead of time, so a visit
// due on the 22nd is only picked up on the 22nd itself.

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { getVisit, getFollowUpObs } = require("./openmrs");
const { buildPrescriptionData, CONCEPT } = require("./data");
const { notifyFollowUpReminder } = require("./turn");

const CRON_SCHEDULE = "50 9 * * *"; // 09:50 daily
const CRON_TIMEZONE = "Asia/Kolkata";

const todayInTimezone = () => new Date().toLocaleDateString("en-CA", { timeZone: CRON_TIMEZONE });

// Restart-safe idempotency: a plain in-memory Set would forget everything on a
// redeploy and re-send to everyone on the next tick. One JSON file keyed
// "visitUuid:date", pruned to today's entries each run.
const SENT_LOG_PATH = path.join(__dirname, ".followup-sent.json");

const loadSentLog = (today) => {
   let log;
   try { log = JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf8")); } catch { log = {}; }
   return Object.fromEntries(Object.entries(log).filter(([key]) => key.endsWith(`:${today}`)));
};

const saveSentLog = (log) => fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(log), "utf8");

// One pass: fetch all follow-up obs, keep the ones due today, resolve each to
// its visit, and send the reminder -- sequentially, so a large list doesn't
// burst Turn's API.
const runFollowUpReminders = async () => {
   const today = todayInTimezone();
   console.log(`[followup cron] run started for ${today}`);

   const sentLog = loadSentLog(today);
   let obsList;
   try {
      obsList = await getFollowUpObs(CONCEPT.FOLLOW_UP);
   } catch (err) {
      console.error("[followup cron] failed to fetch follow-up obs:", err.response?.data || err.message);
      return;
   }

   let sent = 0, skipped = 0, failed = 0;
   for (const obs of obsList) {
      const visitUuid = obs?.encounter?.visit?.uuid;
      if (!visitUuid) continue;

      const logKey = `${visitUuid}:${today}`;
      if (sentLog[logKey]) { skipped++; continue; }

      let data;
      try {
         data = buildPrescriptionData(await getVisit(visitUuid));
      } catch (err) {
         console.error(`[followup cron] ${visitUuid}: visit lookup failed:`, err.response?.data || err.message);
         failed++;
         continue;
      }

      const fu = data.followUp;
      if (fu?.wantFollowUp !== "Yes" || fu.followUpDateIso !== today) continue;

      if (!data.phone) {
         console.warn(`[followup cron] ${visitUuid}: no phone number on file -- skipping`);
         failed++;
         continue;
      }

      try {
         await notifyFollowUpReminder({ number: data.phone, patientName: data.patientName, doctorName: data.doctorName, date: fu.followUpDateIso });
         sentLog[logKey] = true;
         sent++;
         console.log(`[followup cron] ${visitUuid}: reminder sent to ${data.phone}`);
      } catch (err) {
         console.error(`[followup cron] ${visitUuid}: reminder send failed:`, err.response?.data || err.message);
         failed++;
      }
   }

   saveSentLog(sentLog);
   console.log(`[followup cron] run finished -- sent ${sent}, already-sent ${skipped}, failed ${failed}`);
};

// node-cron fires in every process that schedules it, so more than one
// instance running this means every due patient gets it once per instance.
const start = () => {
   cron.schedule(CRON_SCHEDULE, () => {
      runFollowUpReminders().catch((err) => console.error("[followup cron] unexpected error:", err));
   }, { timezone: CRON_TIMEZONE });
   console.log(`[followup cron] scheduled "${CRON_SCHEDULE}" (${CRON_TIMEZONE})`);
};

module.exports = { start, runFollowUpReminders };
