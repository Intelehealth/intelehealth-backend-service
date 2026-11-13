// Stores each follow-up reminder in OpenMRS (for utility-message cost tracking), the
// same way as the post-consultation survey: an encounter on the visit the follow-up
// was advised on, holding a Text obs whose value is JSON.
//
//   Sent    -> new encounter + obs  { type: "followup_reminder", event: "sent",    ... }
//   Tapped  -> extra obs on that encounter { type: "followup_reminder", event: "started", ... }
//
// Cost report: count event "sent" with via "template" (session messages are free).
//
// Config (.env):
//   OPENMRS_CONCEPT_FOLLOWUP_REMINDER         optional override of the concept in constants.js
//                                             (bf72c524-...). "off" disables recording; sends still go
//                                             out, and /followup/sync-openmrs backfills them later.
//   OPENMRS_ENCOUNTER_TYPE_FOLLOWUP_REMINDER  optional; default Patient Exit Survey (shared with the rating
//                                             and the survey, which are told apart by concept).

const { randomUUID } = require("crypto");
const { pushData, getEncounter, postObs } = require("../lib/openmrs");
const {
   OPENMRS_LOCATION_UUID,
   OPENMRS_ENCOUNTER_ROLE_UUID,
   OPENMRS_PROVIDER_UUID,
   OPENMRS_ENCOUNTER_TYPE_PATIENT_EXIT_SURVEY,
   OPENMRS_CONCEPT_FOLLOWUP_REMINDER,
} = require("../constants");

// .env override, else the shared default from constants.js. Set the env var to "off" to disable recording.
const conceptUuid = () => {
   const fromEnv = (process.env.OPENMRS_CONCEPT_FOLLOWUP_REMINDER || "").trim();
   if (fromEnv.toLowerCase() === "off") return "";
   return fromEnv || OPENMRS_CONCEPT_FOLLOWUP_REMINDER;
};
const encounterTypeUuid = () =>
   (process.env.OPENMRS_ENCOUNTER_TYPE_FOLLOWUP_REMINDER || "").trim() || OPENMRS_ENCOUNTER_TYPE_PATIENT_EXIT_SURVEY;
const recordingEnabled = () => Boolean(conceptUuid());

const formatDatetime = (d) => new Date(d).toISOString().replace("Z", "+0000");
const errDetail = (err) => JSON.stringify(err.response?.data || err.message);

// Writes the "sent" encounter. Returns { encounterUuid, saved } -- saved is true/false
// after reading it back (the middleware has said OK before without saving), or null
// if the read-back itself failed. Throws only if the push fails.
const saveReminderSent = async ({
   patientUuid, visitUuid, followUpDate, sentAt, mode, via, template, messageId, phone,
}) => {
   const concept = conceptUuid();
   if (!concept) throw new Error("OPENMRS_CONCEPT_FOLLOWUP_REMINDER is not set");

   const value = JSON.stringify({
      type: "followup_reminder", event: "sent", v: 1,
      follow_up_date: followUpDate, sent_at: sentAt, mode, via, template, message_id: messageId, phone,
   });

   // No visits[] entry: the visit exists, and re-posting would overwrite its attributes.
   const encounterUuid = randomUUID();
   const bundle = {
      appointments: [], providers: [], persons: [], patients: [], visits: [],
      encounters: [{
         uuid: encounterUuid,
         encounterDatetime: formatDatetime(sentAt),
         encounterType: encounterTypeUuid(),
         encounterProviders: [{ encounterRole: OPENMRS_ENCOUNTER_ROLE_UUID, provider: OPENMRS_PROVIDER_UUID }],
         location: OPENMRS_LOCATION_UUID,
         patient: patientUuid,
         visit: visitUuid,
         voided: 0,
         obs: [{ uuid: randomUUID(), concept, value, comments: "" }],
      }],
   };

   const { status } = await pushData(bundle);
   const saved = await verifySaved(encounterUuid, concept);
   console.log(`[followup openmrs] visit ${visitUuid}: sent-record encounter ${encounterUuid} ` +
      `(middleware ${status}) stored: ${saved === true ? "YES" : saved === false ? "NO" : "UNKNOWN"}`);
   return { encounterUuid, saved };
};

// true = encounter + obs present, false = missing, null = could not check.
const verifySaved = async (encounterUuid, concept) => {
   try {
      const enc = await getEncounter(encounterUuid);
      if (!enc) return false;
      const ok = (enc.obs || []).some((o) => o.concept?.uuid === concept && !o.voided);
      if (!ok) console.error(`[followup openmrs] encounter ${encounterUuid} saved without the obs -- does concept ${concept} exist on this server?`);
      return ok;
   } catch (err) {
      console.error(`[followup openmrs] could not read back encounter ${encounterUuid}:`, errDetail(err));
      return null;
   }
};

// Adds the "started" obs (patient tapped फॉलो-अप) to the reminder's encounter.
const saveReminderStarted = async ({ patientUuid, encounterUuid, startedAt, messageId, phone }) => {
   const concept = conceptUuid();
   if (!concept) throw new Error("OPENMRS_CONCEPT_FOLLOWUP_REMINDER is not set");
   if (!encounterUuid) throw new Error("no reminder encounter to attach the tap to");

   const value = JSON.stringify({
      type: "followup_reminder", event: "started", v: 1, started_at: startedAt, message_id: messageId, phone,
   });
   const obs = await postObs({ personUuid: patientUuid, encounterUuid, concept, value, obsDatetime: startedAt });
   console.log(`[followup openmrs] tap recorded: obs ${obs?.uuid} on encounter ${encounterUuid}`);
   return obs?.uuid || null;
};

// Never lets an OpenMRS problem stop a WhatsApp send or a journey reply.
const safely = async (tag, fn) => {
   if (!recordingEnabled()) return null;
   try {
      return await fn();
   } catch (err) {
      console.error(`[followup openmrs] ${tag} failed:`, errDetail(err));
      return null;
   }
};

module.exports = { recordingEnabled, saveReminderSent, saveReminderStarted, safely };
