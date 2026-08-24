// Sends WhatsApp follow-up reminders. Re-scans all follow-up obs on every run and nudges whoever is due.

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { getVisit, getFollowUpObs } = require("./openmrs");
const { buildPrescriptionData, CONCEPT } = require("./data");
const { notifyFollowUpReminder } = require("./turn");
const { recordPending, daysBetween } = require("./followup-pending");

// TESTING: fires every 30 min. Real schedule is "50 9 * * *" (09:50 daily) -- switch back before shipping.
const CRON_SCHEDULE = "*/30 * * * *";
const CRON_TIMEZONE = "Asia/Kolkata";

// Nudge on the day before (1) and the day of (0) the follow-up date.
const REMINDER_OFFSETS = (process.env.FOLLOWUP_REMINDER_OFFSETS || "1,0")
   .split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0)
   .sort((a, b) => b - a);

const todayInTimezone = () => new Date().toLocaleDateString("en-CA", { timeZone: CRON_TIMEZONE });
const errDetail = (err) => err.response?.data || err.message;

// Sent-log: which visit+offset was already nudged today, so a restart or a second run never double-sends.
const SENT_LOG_PATH = path.join(__dirname, ".followup-sent.json");
const sentKey = (today, visitUuid, offset) => `${today}|${visitUuid}|d${offset}`;

const loadSentLog = (today) => {
   let log;
   try { log = JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf8")); } catch { log = {}; }
   return Object.fromEntries(Object.entries(log).filter(([key]) => key.startsWith(`${today}|`)));
};

const saveSentLog = (log) => fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(log), "utf8");

// A specific visit skips the obs scan (cheap single-patient testing); otherwise scan and dedupe by visit.
const collectVisitUuids = async (onlyVisitUuid) => {
   if (onlyVisitUuid) return [onlyVisitUuid];
   const obsList = await getFollowUpObs(CONCEPT.FOLLOW_UP);
   return [...new Set(obsList.map((obs) => obs?.encounter?.visit?.uuid).filter(Boolean))];
};

// Runs one pass: find due visits and send each a reminder, one at a time.
const runFollowUpReminders = async ({ visitUuid: onlyVisitUuid = null, force = false, dryRun = false, trigger = "cron" } = {}) => {
   const today = todayInTimezone();
   const tag = `[followup ${trigger}]`;
   console.log(`${tag} run started for ${today} -- nudging T-${REMINDER_OFFSETS.join(" and T-")}${force ? " [force]" : ""}${dryRun ? " [dry-run]" : ""}`);

   const sentLog = loadSentLog(today);
   let visitUuids;
   try {
      visitUuids = await collectVisitUuids(onlyVisitUuid);
   } catch (err) {
      console.error(`${tag} failed to fetch follow-up obs:`, errDetail(err));
      return { ok: false, today, error: errDetail(err), considered: 0, sent: 0, skipped: 0, failed: 0, results: [] };
   }

   const results = [];
   let sent = 0, skipped = 0, failed = 0;

   for (const visitUuid of visitUuids) {
      let data;
      try {
         data = buildPrescriptionData(await getVisit(visitUuid));
      } catch (err) {
         failed++;
         results.push({ visit_uuid: visitUuid, status: "lookup-failed", reason: errDetail(err) });
         continue;
      }

      const fu = data.followUp;
      if (fu?.wantFollowUp !== "Yes" || !fu.followUpDateIso) {
         results.push({ visit_uuid: visitUuid, status: "no-follow-up" });
         continue;
      }

      // Days until the follow-up date; 1 = tomorrow, 0 = today.
      const daysUntil = daysBetween(today, fu.followUpDateIso);
      const offset = force ? (REMINDER_OFFSETS[REMINDER_OFFSETS.length - 1] ?? 0) : daysUntil;
      if (!force && !REMINDER_OFFSETS.includes(daysUntil)) {
         results.push({ visit_uuid: visitUuid, status: daysUntil < 0 ? "past-due" : "not-due", due: fu.followUpDateIso, days_until: daysUntil });
         continue;
      }

      const logKey = sentKey(today, visitUuid, offset);
      if (!force && sentLog[logKey]) {
         skipped++;
         results.push({ visit_uuid: visitUuid, status: "already-sent", due: fu.followUpDateIso });
         continue;
      }

      if (!data.phone) {
         failed++;
         results.push({ visit_uuid: visitUuid, status: "no-phone", due: fu.followUpDateIso });
         continue;
      }

      const shared = {
         visit_uuid: visitUuid, patient_uuid: data.patientUuid, openmrs_id: data.patientId,
         patient_name: data.patientName, doctor_name: data.doctorName, number: data.phone,
         due: fu.followUpDateIso, days_until: daysUntil,
      };

      if (dryRun) {
         results.push({ ...shared, status: "would-send" });
         continue;
      }

      try {
         await notifyFollowUpReminder({
            number: data.phone, patientName: data.patientName, doctorName: data.doctorName,
            openmrsId: data.patientId, date: fu.followUpDateIso, payload: visitUuid,
         });
         sentLog[logKey] = true;
         sent++;

         // Remember who this nudge was for, so a button reply can be matched back to a patient.
         try {
            recordPending({
               phone: data.phone, today, patientUuid: data.patientUuid, patientName: data.patientName,
               openmrsId: data.patientId, visitUuid, followUpDate: fu.followUpDateIso, doctorName: data.doctorName,
            });
         } catch (err) {
            console.error(`${tag} ${visitUuid}: pending-store write failed:`, err.message);
         }

         results.push({ ...shared, status: "sent" });
         console.log(`${tag} ${visitUuid}: nudge sent to ${data.phone} (T-${daysUntil}, ${data.patientName})`);
      } catch (err) {
         failed++;
         results.push({ ...shared, status: "send-failed", reason: errDetail(err) });
      }
   }

   if (!dryRun) saveSentLog(sentLog);
   console.log(`${tag} run finished -- sent ${sent}, already-sent ${skipped}, failed ${failed}`);
   return { ok: true, today, offsets: REMINDER_OFFSETS, dry_run: dryRun, forced: force, considered: visitUuids.length, sent, skipped, failed, results };
};

let task = null; // scheduled task handle, kept so /followup/status can report on it

// Schedules the cron. node-cron fires per process, so run only one instance to avoid duplicate sends.
const start = () => {
   if (task) return task;
   task = cron.schedule(CRON_SCHEDULE, () => {
      runFollowUpReminders().catch((err) => console.error("[followup cron] unexpected error:", err));
   }, { timezone: CRON_TIMEZONE, name: "followup-reminder", noOverlap: true });
   console.log(`[followup cron] scheduled "${CRON_SCHEDULE}" (${CRON_TIMEZONE}) -- next run ${task.getNextRun()?.toISOString() || "unknown"}`);
   return task;
};

// Reports cron health without waiting for it to fire: schedule, next runs, and today's sent-log.
const getCronInfo = () => {
   const today = todayInTimezone();
   const sentLog = loadSentLog(today);

   let logStat = null;
   try {
      const { mtime, size } = fs.statSync(SENT_LOG_PATH);
      logStat = { modified: mtime.toISOString(), bytes: size };
   } catch { /* never run yet */ }

   const last = task?.lastRun?.() || null;
   return {
      scheduled: Boolean(task), schedule: CRON_SCHEDULE, timezone: CRON_TIMEZONE, reminder_offsets: REMINDER_OFFSETS,
      status: task?.getStatus?.() || "not-scheduled", busy: task?.isBusy?.() ?? false,
      next_run: task?.getNextRun?.()?.toISOString() || null, ms_to_next: task?.msToNext?.() ?? null,
      next_runs: task?.getNextRuns?.(3)?.map((d) => d.toISOString()) || [],
      last_run: last ? { at: last.date?.toISOString?.() || null, error: last.error?.message || null } : null,
      today, server_time_utc: new Date().toISOString(), pid: process.pid,
      sent_log: { path: SENT_LOG_PATH, entries_today: Object.keys(sentLog).length, ...(logStat || {}) },
   };
};

module.exports = { start, runFollowUpReminders, getCronInfo };
