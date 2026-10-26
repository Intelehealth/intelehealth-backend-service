// Post-consultation survey (IDTP-177): sends the 86B Hindi questionnaire template to every
// patient whose prescription was shared SURVEY_DELAY_DAYS (default 7) days ago.
//
//   Daily cron -> prescriptions dated SURVEY_START_DATE .. (today - delay), so a
//                 missed day is caught up on the next run.
//   Bulk       -> manual only, run once by hand for past records:
//                 POST /survey/run { "from": "2026-09-01", "to": "2026-10-16" }
//   Manual     -> POST /survey/run { from, to } or { visit_uuid } to send a window or one visit now.
//
// Each visit gets the survey at most once. The sent-log keeps when it was sent
// (utility-message cost tracking) until the survey DB tables exist.

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { getVisit, getCompletedVisits } = require("./openmrs");
const { buildPrescriptionData } = require("./data");
const { notifyPostConsultationSurvey, normalizeNumber } = require("./turn");

const CRON_SCHEDULE = process.env.SURVEY_CRON_SCHEDULE || "0 10 * * *"; // 10:00 daily
const CRON_TIMEZONE = "Asia/Kolkata";

const DELAY_DAYS = Number(process.env.SURVEY_DELAY_DAYS || 7);
// First prescription date the daily cron covers; older ones go through the manual bulk.
const START_DATE = process.env.SURVEY_START_DATE || "2026-10-17";
// Pause between sends so a bulk run doesn't burst the Turn API.
const SEND_DELAY_MS = Number(process.env.SURVEY_SEND_DELAY_MS || 500);
// Most surveys one automatic run (bulk or daily) sends; the rest go out on the next
// day's run. Caps utility-message spend per day. 0 = no limit.
const MAX_PER_RUN = Number(process.env.SURVEY_MAX_PER_RUN ?? 10);
// Completed lists come newest-first; stop paging once a whole page was created
// this long before the window (a prescription is shared well within this).
const LOOKBACK_DAYS = 30;

const VISIT_COMPLETE = "visit complete"; // encounter type name of "Share Prescription"

const surveyEnabled = () => process.env.SURVEY_ENABLED === "true";
const errDetail = (err) => err.response?.data || err.message;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// YYYY-MM-DD in IST, for a Date or anything Date can parse.
const istDate = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: CRON_TIMEZONE });
const todayInTimezone = () => istDate(new Date());
const addDays = (isoDate, n) => {
   const d = new Date(`${isoDate}T00:00:00Z`);
   d.setUTCDate(d.getUTCDate() + n);
   return d.toISOString().slice(0, 10);
};
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// "2026-10-16" -> "16 Oct 2026" for {{2}}. Fixed names: ICU prints "Sept" for en-GB.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtSurveyDate = (isoDate) => {
   const [y, m, d] = isoDate.split("-");
   return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
};

// Patient names come back upper-cased from buildPrescriptionData. Drop the "."
// placeholder family name registration uses when there's no surname.
const titleCase = (s) =>
   String(s || "").split(/\s+/).filter((w) => w && w !== ".").join(" ")
      .toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// Portal-registered numbers are often 10 digits; WhatsApp needs the country code.
const toWhatsAppNumber = (phone) => {
   const digits = normalizeNumber(phone);
   return digits.length === 10 ? `91${digits}` : digits;
};

// Date the prescription was first shared: earliest Visit Complete encounter.
const prescriptionDateOf = (item) => {
   const dates = (item?.encounters || [])
      .filter((e) => String(e?.type?.name || "").toLowerCase() === VISIT_COMPLETE)
      .map((e) => e.encounter_datetime)
      .filter(Boolean)
      .sort();
   return dates.length ? istDate(dates[0]) : null;
};

// ---- sent-log: { [visitUuid]: { sent_at, mode, phone, patient_uuid, prescription_date } } ----
const SENT_LOG_PATH = path.join(__dirname, ".survey-sent.json");
const loadSentLog = () => {
   try { return JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf8")); } catch { return {}; }
};
const saveSentLog = (log) => fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(log, null, 1), "utf8");

// The survey a reply belongs to: the latest one sent to this number that hasn't
// been answered yet (falls back to the latest one, so a duplicate reply is
// reported as such instead of "no survey"). Returns { visitUuid, ...entry } or null.
const findSurveyForPhone = (phone) => {
   const number = toWhatsAppNumber(phone);
   if (!number) return null;
   const mine = Object.entries(loadSentLog())
      .filter(([, e]) => e?.phone === number)
      .sort(([, a], [, b]) => String(b.sent_at).localeCompare(String(a.sent_at)));
   const [visitUuid, entry] = mine.find(([, e]) => !e.answered_at) || mine[0] || [];
   return visitUuid ? { visitUuid, ...entry } : null;
};

const markSurveyAnswered = (visitUuid, { encounterUuid }) => {
   const log = loadSentLog();
   if (!log[visitUuid]) return;
   log[visitUuid] = { ...log[visitUuid], answered_at: new Date().toISOString(), encounter_uuid: encounterUuid };
   saveSentLog(log);
};

// Completed visits whose prescription date falls in [from, to], newest prescription first.
const collectCandidates = async (from, to) => {
   const cutoff = addDays(from, -LOOKBACK_DAYS);
   const visits = await getCompletedVisits({
      stopAfterPage: (page) => page.every((v) => v?.date_created && istDate(v.date_created) < cutoff),
   });

   const inWindow = visits
      .map((v) => ({ visitUuid: v.uuid, prescriptionDate: prescriptionDateOf(v) }))
      .filter((c) => c.visitUuid && c.prescriptionDate && c.prescriptionDate >= from && c.prescriptionDate <= to)
      .sort((a, b) => b.prescriptionDate.localeCompare(a.prescriptionDate));

   console.log(`[survey] ${inWindow.length}/${visits.length} completed visits have a prescription dated ${from}..${to}`);
   return inWindow;
};

let running = false; // one pass at a time -- a bulk run and the cron must not double-send

// One pass. Options:
//   from/to   prescription-date window (YYYY-MM-DD); defaults to the daily window
//   visitUuid send for just this visit (testing; skips the date window)
//   force     resend even if the sent-log has this visit
//   limit     stop after this many sends (try a bulk run on a few patients first)
const runSurvey = async ({ from, to, visitUuid = null, force = false, limit = 0, trigger = "cron" } = {}) => {
   const today = todayInTimezone();
   const tag = `[survey ${trigger}]`;

   if (!surveyEnabled()) {
      console.log(`${tag} skipped -- SURVEY_ENABLED is not "true"`);
      return { ok: true, today, disabled: true, considered: 0, sent: 0, skipped: 0, failed: 0, results: [] };
   }
   if (running) {
      console.warn(`${tag} skipped -- another survey run is still in progress`);
      return { ok: false, today, busy: true, error: "another survey run is in progress" };
   }

   const windowTo = to || addDays(today, -DELAY_DAYS);
   const windowFrom = from || START_DATE;
   if (!visitUuid && (!isIsoDate(windowFrom) || !isIsoDate(windowTo))) {
      return { ok: false, today, error: "from/to must be YYYY-MM-DD" };
   }

   running = true;
   try {
      console.log(`${tag} run started for ${today} -- ${visitUuid ? `visit ${visitUuid}` : `prescriptions ${windowFrom}..${windowTo}`}` +
         `${force ? " [force]" : ""}${limit ? ` [limit ${limit}]` : ""}`);

      if (!visitUuid && windowFrom > windowTo) {
         console.log(`${tag} nothing due yet (window ${windowFrom}..${windowTo} is empty)`);
         return { ok: true, today, from: windowFrom, to: windowTo, considered: 0, sent: 0, skipped: 0, failed: 0, results: [] };
      }

      let candidates;
      try {
         candidates = visitUuid ? [{ visitUuid, prescriptionDate: null }] : await collectCandidates(windowFrom, windowTo);
      } catch (err) {
         console.error(`${tag} failed to fetch completed visits:`, errDetail(err));
         return { ok: false, today, error: errDetail(err), considered: 0, sent: 0, skipped: 0, failed: 0, results: [] };
      }

      const sentLog = loadSentLog();
      // Latest prescription date each patient was already surveyed for. Candidates run
      // newest-first, so a patient gets one survey for their latest prescription and
      // never one for an older prescription afterwards; a newer one still triggers.
      const surveyedUpTo = new Map();
      for (const e of Object.values(sentLog)) {
         if (e?.patient_uuid && e.prescription_date > (surveyedUpTo.get(e.patient_uuid) || "")) {
            surveyedUpTo.set(e.patient_uuid, e.prescription_date);
         }
      }
      const results = [];
      let sent = 0, skipped = 0, failed = 0, limited = false;

      for (const { visitUuid: uuid, prescriptionDate } of candidates) {
         if (limit && sent >= limit) { limited = true; break; }

         if (!force && sentLog[uuid]) {
            skipped++;
            results.push({ visit_uuid: uuid, status: "already-sent", sent_at: sentLog[uuid].sent_at });
            continue;
         }

         let data, visit;
         try {
            visit = await getVisit(uuid);
            data = buildPrescriptionData(visit);
         } catch (err) {
            failed++;
            results.push({ visit_uuid: uuid, status: "lookup-failed", reason: errDetail(err) });
            continue;
         }

         // Single-visit runs don't have the list item; read the date off the full visit.
         const rxDate = prescriptionDate || prescriptionDateOf({
            encounters: (visit?.encounters || []).map((e) => ({
               encounter_datetime: e.encounterDatetime, type: { name: e.encounterType?.display },
            })),
         });

         if (!data.shared || !rxDate) {
            results.push({ visit_uuid: uuid, status: "no-prescription" });
            continue;
         }

         const coveredUpTo = data.patientUuid && surveyedUpTo.get(data.patientUuid);
         if (!force && coveredUpTo && coveredUpTo >= rxDate) {
            skipped++;
            results.push({ visit_uuid: uuid, patient_uuid: data.patientUuid, status: "patient-already-surveyed", covered_up_to: coveredUpTo });
            continue;
         }

         const number = toWhatsAppNumber(data.phone);
         const shared = {
            visit_uuid: uuid, patient_uuid: data.patientUuid, openmrs_id: data.patientId,
            patient_name: titleCase(data.patientName), number, prescription_date: rxDate,
         };

         if (!number) {
            failed++;
            results.push({ ...shared, status: "no-phone" });
            continue;
         }

         try {
            const { messageId, response, template } = await notifyPostConsultationSurvey({
               number, patientName: shared.patient_name, date: fmtSurveyDate(rxDate),
            });
            console.log(`${tag} ${uuid}: Turn response:`, JSON.stringify(response));
            const sentAt = new Date().toISOString();
            sentLog[uuid] = {
               sent_at: sentAt, mode: trigger, phone: number, patient_uuid: data.patientUuid,
               prescription_date: rxDate, template, message_id: messageId,
            };
            saveSentLog(sentLog); // per send, so a crash mid-bulk never re-sends what already went out
            if (data.patientUuid) surveyedUpTo.set(data.patientUuid, rxDate);
            sent++;
            results.push({ ...shared, status: "sent", sent_at: sentAt, message_id: messageId });
            console.log(`${tag} ${uuid}: survey sent to ${number} (${shared.patient_name}, prescription ${rxDate}) message_id=${messageId}`);
         } catch (err) {
            failed++;
            results.push({ ...shared, status: "send-failed", reason: errDetail(err) });
            console.error(`${tag} ${uuid}: send failed:`, JSON.stringify(errDetail(err)));
         }

         if (SEND_DELAY_MS) await sleep(SEND_DELAY_MS);
      }

      console.log(`${tag} run finished -- sent ${sent}, skipped ${skipped}, failed ${failed}` +
         (limited ? ` -- stopped at limit ${limit}, the rest go out on the next run` : ""));
      return {
         ok: true, today, from: visitUuid ? null : windowFrom, to: visitUuid ? null : windowTo,
         forced: force, limit: limit || null, limited, considered: candidates.length, sent, skipped, failed, results,
      };
   } finally {
      running = false;
   }
};

let task = null;

// node-cron fires per process, so run only one instance to avoid duplicate sends.
const start = () => {
   if (!surveyEnabled()) {
      console.log("[survey cron] disabled -- set SURVEY_ENABLED=true to enable");
      return null;
   }
   if (task) return task;
   task = cron.schedule(CRON_SCHEDULE, async () => {
      try {
         await runSurvey({ limit: MAX_PER_RUN });
      } catch (err) {
         console.error("[survey cron] unexpected error:", err);
      }
   }, { timezone: CRON_TIMEZONE, name: "post-consultation-survey", noOverlap: true });
   console.log(`[survey cron] scheduled "${CRON_SCHEDULE}" (${CRON_TIMEZONE}), ${DELAY_DAYS} days after prescription, ` +
      `from ${START_DATE} -- next run ${task.getNextRun()?.toISOString() || "unknown"}`);
   return task;
};

const getSurveyCronInfo = () => {
   const today = todayInTimezone();
   const sentLog = loadSentLog();
   const entries = Object.values(sentLog);
   const last = task?.lastRun?.() || null;
   return {
      enabled: surveyEnabled(), scheduled: Boolean(task), schedule: CRON_SCHEDULE, timezone: CRON_TIMEZONE,
      delay_days: DELAY_DAYS, max_per_run: MAX_PER_RUN || "no limit", start_date: START_DATE, daily_window: { from: START_DATE, to: addDays(today, -DELAY_DAYS) },
      busy: running, next_run: task?.getNextRun?.()?.toISOString() || null,
      last_run: last ? { at: last.date?.toISOString?.() || null, error: last.error?.message || null } : null,
      today, server_time_utc: new Date().toISOString(), pid: process.pid,
      sent_log: {
         path: SENT_LOG_PATH, total_sent: entries.length,
         sent_today: entries.filter((e) => e.sent_at && istDate(e.sent_at) === today).length,
      },
   };
};

module.exports = { start, runSurvey, getSurveyCronInfo, surveyEnabled, findSurveyForPhone, markSurveyAnswered };
