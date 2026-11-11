// Sends WhatsApp follow-up reminders (template from FOLLOWUP_TEMPLATE_NAME) with a
// "Start Follow Up Visit" button. Re-fetches the mindmap follow-up list on every run
// and nudges whoever is due.
//
//   Daily cron -> 09:50 IST, patients whose follow-up is today (FOLLOWUP_REMINDER_OFFSETS, default "0").
//   Bulk       -> manual only, run once by hand for past follow-ups:
//                 POST /followup/run { "from": "2026-09-01", "to": "2026-11-01" }
//   Manual     -> POST /followup/run { visit_uuid } to send one visit now.


const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { getVisit, getFollowUpVisits } = require("./openmrs");
const { buildPrescriptionData, fmtFollowUpDate } = require("./data");
const { notifyFollowUpStart, toWhatsAppNumber } = require("./turn");
const { recordPending, daysBetween } = require("./followup-pending");

const CRON_SCHEDULE = process.env.FOLLOWUP_CRON_SCHEDULE || "50 9 * * *"; // 09:50 daily
const CRON_TIMEZONE = "Asia/Kolkata";

// Days before the follow-up date to nudge; 0 = the day itself.
const REMINDER_OFFSETS = (process.env.FOLLOWUP_REMINDER_OFFSETS || "0")
   .split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0)
   .sort((a, b) => b - a);
const TEMPLATE_NAME = process.env.FOLLOWUP_TEMPLATE_NAME || null;
const TEMPLATE_LANGUAGE = process.env.FOLLOWUP_TEMPLATE_LANGUAGE || "hi";
// Pause between sends so a bulk run doesn't burst the Turn API.
const SEND_DELAY_MS = Number(process.env.FOLLOWUP_SEND_DELAY_MS || 500);

const todayInTimezone = () => new Date().toLocaleDateString("en-CA", { timeZone: CRON_TIMEZONE });
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const errDetail = (err) => err.response?.data || err.message;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Patient names come back upper-cased from buildPrescriptionData. Drop the "."
// placeholder family name registration uses when there's no surname.
const titleCase = (s) =>
   String(s || "").split(/\s+/).filter((w) => w && w !== ".").join(" ")
      .toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// {{2}} reads "आपने {{2}} से सलाह ली थी". Provider display is "<identifier> - <name>"
// (e.g. "21-6 - rohith M s"), so keep only the name: "Dr. Rohith M S".
const doctorLabel = (display) => {
   const name = titleCase(String(display || "").replace(/^.*?\s-\s/, "").replace(/^dr\.?\s*/i, ""));
   return name ? `Dr. ${name}` : "";
};

// ---- sent-log: { [visitUuid|followUpDate|slot]: { sent_at, mode, phone, patient_uuid, visit_uuid, follow_up_date, template, message_id } } ----
// The slot is "d1", "d2"... for advance nudges and "due" for the day itself or later,
// so the daily send and a bulk send for the same follow-up never both go out.
const SENT_LOG_PATH = path.join(__dirname, ".followup-sent-log.json");
const sentKey = (visitUuid, dueDate, daysUntil) => `${visitUuid}|${dueDate}|${daysUntil > 0 ? `d${daysUntil}` : "due"}`;

const loadSentLog = () => {
   try { return JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf8")); } catch { return {}; }
};
const saveSentLog = (log) => fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(log, null, 1), "utf8");

// mindmap's own concept id for the follow-up obs
const MINDMAP_FOLLOWUP_CONCEPT_ID = 163345;
const followUpDateFromMindmap = (visit) => {
   const value = visit.encounters?.flatMap((e) => e.obs || [])
      .find((o) => o.concept_id === MINDMAP_FOLLOWUP_CONCEPT_ID)?.value_text;
   return value?.split(",")[0]?.trim() || null;
};

// A specific visit skips the mindmap scan entirely (cheap single-patient testing).
// Otherwise fetch every candidate but only keep the ones due (daily) or dated in the
// bulk window -- so getVisit only runs for those.
const collectVisitUuids = async ({ onlyVisitUuid, today, from, to }) => {
   if (onlyVisitUuid) return [onlyVisitUuid];

   const visits = await getFollowUpVisits();
   const inScope = (dueDate) => (from
      ? dueDate >= from && dueDate <= to
      : REMINDER_OFFSETS.includes(daysBetween(today, dueDate)));
   const due = visits.filter((v) => {
      const dueDate = followUpDateFromMindmap(v);
      return dueDate && inScope(dueDate);
   });

   console.log(`[followup mindmap] ${due.length}/${visits.length} visits ${from ? `with a follow-up dated ${from}..${to}` : "due"}` +
      " -- skipping getVisit for the rest");
   return [...new Set(due.map((v) => v?.uuid).filter(Boolean))];
};

let running = false; // one pass at a time -- a bulk run and the cron must not double-send

// Runs one pass: find due visits and send each a reminder, one at a time. Options:
//   from/to   bulk: follow-up-date window (YYYY-MM-DD) instead of "due today"
//   visitUuid send for just this visit (testing; skips the date check)
//   force     resend even if the sent-log has this follow-up
//   limit     stop after this many sends
//   dryRun    report what would be sent, send nothing
const runFollowUpReminders = async ({
   visitUuid: onlyVisitUuid = null, from = null, to = null, force = false, limit = 0, dryRun = false, trigger = "cron",
} = {}) => {
   const today = todayInTimezone();
   const tag = `[followup ${trigger}]`;

   // dryRun still reports what would be sent; only real sends are blocked.
   if (!remindersEnabled() && !dryRun) {
      console.log(`${tag} skipped -- FOLLOWUP_REMINDERS_ENABLED is not "true"`);
      return { ok: true, today, disabled: true, considered: 0, sent: 0, skipped: 0, failed: 0, results: [] };
   }
   if (running) {
      console.warn(`${tag} skipped -- another follow-up run is still in progress`);
      return { ok: false, today, busy: true, error: "another follow-up run is in progress" };
   }
   if ((from || to) && (!isIsoDate(from) || !isIsoDate(to) || from > to)) {
      return { ok: false, today, error: "bulk needs both from and to as YYYY-MM-DD, with from <= to" };
   }

   running = true;
   try {
      console.log(`${tag} run started for ${today} -- ` +
         `${onlyVisitUuid ? `visit ${onlyVisitUuid}` : from ? `follow-ups dated ${from}..${to}` : `nudging T-${REMINDER_OFFSETS.join(" and T-")}`}` +
         `${force ? " [force]" : ""}${limit ? ` [limit ${limit}]` : ""}${dryRun ? " [dry-run]" : ""}`);

      let visitUuids;
      try {
         visitUuids = await collectVisitUuids({ onlyVisitUuid, today, from, to });
      } catch (err) {
         console.error(`${tag} failed to fetch follow-up visits:`, errDetail(err));
         return { ok: false, today, error: errDetail(err), considered: 0, sent: 0, skipped: 0, failed: 0, results: [] };
      }

      const sentLog = loadSentLog();
      const results = [];
      let sent = 0, skipped = 0, failed = 0, limited = false;

      for (const visitUuid of visitUuids) {
         if (limit && sent >= limit) { limited = true; break; }

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

         // Days until the follow-up date; 1 = tomorrow, 0 = today, negative = past (bulk only).
         const daysUntil = daysBetween(today, fu.followUpDateIso);
         const inScope = onlyVisitUuid || force
            || (from ? fu.followUpDateIso >= from && fu.followUpDateIso <= to : REMINDER_OFFSETS.includes(daysUntil));
         if (!inScope) {
            results.push({ visit_uuid: visitUuid, status: daysUntil < 0 ? "past-due" : "not-due", due: fu.followUpDateIso, days_until: daysUntil });
            continue;
         }

         const logKey = sentKey(visitUuid, fu.followUpDateIso, daysUntil);
         if (!force && sentLog[logKey]) {
            skipped++;
            results.push({ visit_uuid: visitUuid, status: "already-sent", due: fu.followUpDateIso, sent_at: sentLog[logKey].sent_at });
            continue;
         }

         const number = toWhatsAppNumber(data.phone);
         const shared = {
            visit_uuid: visitUuid, patient_uuid: data.patientUuid, openmrs_id: data.patientId,
            patient_name: titleCase(data.patientName), doctor_name: doctorLabel(data.doctorName), number,
            due: fu.followUpDateIso, days_until: daysUntil,
         };

         if (!number) {
            failed++;
            results.push({ ...shared, status: "no-phone" });
            continue;
         }

         if (dryRun) {
            results.push({ ...shared, status: "would-send" });
            continue;
         }

         try {
            const { messageId, template } = await notifyFollowUpStart({
               number, patientName: shared.patient_name, doctorName: shared.doctor_name,
               date: fmtFollowUpDate(fu.followUpDateIso),
            });
            const sentAt = new Date().toISOString();
            sentLog[logKey] = {
               sent_at: sentAt, mode: trigger, phone: number, patient_uuid: data.patientUuid, visit_uuid: visitUuid,
               follow_up_date: fu.followUpDateIso, template, message_id: messageId,
            };
            saveSentLog(sentLog); // per send, so a crash mid-bulk never re-sends what already went out
            sent++;

            // Remember who this nudge was for, so the "Start follow-up" tap can be matched back to a patient.
            try {
               recordPending({
                  phone: number, today, patientUuid: data.patientUuid, patientName: data.patientName,
                  openmrsId: data.patientId, visitUuid, followUpDate: fu.followUpDateIso, doctorName: data.doctorName, messageId,
               });
            } catch (err) {
               console.error(`${tag} ${visitUuid}: pending-store write failed:`, err.message);
            }

            // via: "session" = free-form message inside the 24h window, "template" = approved template.
            const via = template === "session-message" ? "session" : "template";
            results.push({ ...shared, status: "sent", via, template, sent_at: sentAt, message_id: messageId });
            console.log(`${tag} ${visitUuid}: nudge sent to ${number} via ${via} (${template}) (T-${daysUntil}, ${data.patientName}) message_id=${messageId}`);
         } catch (err) {
            failed++;
            results.push({ ...shared, status: "send-failed", reason: errDetail(err) });
            console.error(`${tag} ${visitUuid}: send failed:`, JSON.stringify(errDetail(err)));
         }

         if (SEND_DELAY_MS) await sleep(SEND_DELAY_MS);
      }

      console.log(`${tag} run finished -- sent ${sent}, already-sent ${skipped}, failed ${failed}` +
         (limited ? ` -- stopped at limit ${limit}` : ""));
      return {
         ok: true, today, offsets: REMINDER_OFFSETS, from, to, dry_run: dryRun, forced: force, limit: limit || null, limited,
         considered: visitUuids.length, sent, skipped, failed, results,
      };
   } finally {
      running = false;
   }
};

let task = null; // scheduled task handle, kept so /followup/status can report on it

// Reminders are opt-in: this cron messages patients directly through the Turn
// API, outside the journey, so hiding the follow-up cards in Turn does not stop
// it. Set FOLLOWUP_REMINDERS_ENABLED=true to turn it back on.
const remindersEnabled = () => process.env.FOLLOWUP_REMINDERS_ENABLED === "true";

// Schedules the cron. node-cron fires per process, so run only one instance to avoid duplicate sends.
const start = () => {
   if (!remindersEnabled()) {
      console.log("[followup cron] disabled -- set FOLLOWUP_REMINDERS_ENABLED=true to enable");
      return null;
   }
   if (task) return task;
   task = cron.schedule(CRON_SCHEDULE, () => {
      runFollowUpReminders().catch((err) => console.error("[followup cron] unexpected error:", err));
   }, { timezone: CRON_TIMEZONE, name: "followup-reminder", noOverlap: true });
   console.log(`[followup cron] scheduled "${CRON_SCHEDULE}" (${CRON_TIMEZONE}) -- next run ${task.getNextRun()?.toISOString() || "unknown"}`);
   return task;
};

// Reports cron health without waiting for it to fire: schedule, next runs, and the sent-log totals.
const getCronInfo = () => {
   const today = todayInTimezone();
   const entries = Object.values(loadSentLog());

   const last = task?.lastRun?.() || null;
   return {
      enabled: remindersEnabled(), scheduled: Boolean(task), schedule: CRON_SCHEDULE, timezone: CRON_TIMEZONE,
      reminder_offsets: REMINDER_OFFSETS, template: TEMPLATE_NAME, template_language: TEMPLATE_LANGUAGE,
      status: task?.getStatus?.() || "not-scheduled", busy: running,
      next_run: task?.getNextRun?.()?.toISOString() || null, ms_to_next: task?.msToNext?.() ?? null,
      next_runs: task?.getNextRuns?.(3)?.map((d) => d.toISOString()) || [],
      last_run: last ? { at: last.date?.toISOString?.() || null, error: last.error?.message || null } : null,
      today, server_time_utc: new Date().toISOString(), pid: process.pid,
      sent_log: {
         path: SENT_LOG_PATH, total_sent: entries.length,
         sent_today: entries.filter((e) => e.sent_at && new Date(e.sent_at).toLocaleDateString("en-CA", { timeZone: CRON_TIMEZONE }) === today).length,
      },
   };
};

module.exports = { start, runFollowUpReminders, getCronInfo, remindersEnabled };
