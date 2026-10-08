// Exit-survey (patient feedback) storage. The doctor portal treats an exit survey
// encounter as "visit ended", so a rating that arrives before the doctor shares the
// prescription is held here on disk and written to OpenMRS once the prescription is sent.

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { pushData } = require("./openmrs");
const {
  OPENMRS_LOCATION_UUID,
  OPENMRS_ENCOUNTER_TYPE_PATIENT_EXIT_SURVEY,
  OPENMRS_ENCOUNTER_ROLE_UUID,
  OPENMRS_PROVIDER_UUID,
  OPENMRS_CONCEPT_RATING,
  OPENMRS_CONCEPT_COMMENTS,
} = require("../constants");

const HELD_STORE_PATH = path.join(__dirname, "..", ".feedback-pending.json");

const formatDatetime = (d) => d.toISOString().replace("Z", "+0000");

// No visits[] entry: the visit exists, and re-posting would overwrite its attributes.
const buildSurveyBundle = ({ personUuid, visitUuid, rating, feedback }) => {
  const obs = [{ concept: OPENMRS_CONCEPT_RATING, value: rating, comments: "" }];
  if (feedback) obs.push({ concept: OPENMRS_CONCEPT_COMMENTS, value: feedback, comments: "" });

  return {
    appointments: [],
    providers: [],
    persons: [],
    patients: [],
    visits: [],
    encounters: [
      {
        uuid: randomUUID(),
        encounterDatetime: formatDatetime(new Date()),
        encounterType: OPENMRS_ENCOUNTER_TYPE_PATIENT_EXIT_SURVEY,
        encounterProviders: [
          { encounterRole: OPENMRS_ENCOUNTER_ROLE_UUID, provider: OPENMRS_PROVIDER_UUID },
        ],
        location: OPENMRS_LOCATION_UUID,
        patient: personUuid,
        visit: visitUuid,
        voided: 0,
        obs: obs.map((o) => ({ uuid: randomUUID(), ...o })),
      },
    ],
  };
};

// Writes the exit-survey encounter; returns its uuid.
const saveFeedback = async ({ personUuid, visitUuid, rating, feedback }) => {
  const bundle = buildSurveyBundle({ personUuid, visitUuid, rating, feedback });
  const { data } = await pushData(bundle);
  console.log(`[feedback] saved for visit ${visitUuid}:`, JSON.stringify(data));
  return bundle.encounters[0].uuid;
};

const loadStore = () => {
  try { return JSON.parse(fs.readFileSync(HELD_STORE_PATH, "utf8")); } catch { return {}; }
};

const saveStore = (store) => fs.writeFileSync(HELD_STORE_PATH, JSON.stringify(store), "utf8");

// Hold (or overwrite) a rating for a visit the doctor hasn't completed yet; the latest rating wins.
const holdFeedback = ({ personUuid, visitUuid, rating, feedback }) => {
  const store = loadStore();
  store[visitUuid] = { personUuid, visitUuid, rating, feedback, heldAt: new Date().toISOString() };
  saveStore(store);
};

const hasHeldFeedback = (visitUuid) => Boolean(loadStore()[visitUuid]);

// Called once the prescription is shared. Writes the held rating, if any, and drops it
// from the store only after OpenMRS accepted it, so a failed write retries on the next share.
const flushHeldFeedback = async (visitUuid) => {
  const held = loadStore()[visitUuid];
  if (!held) return null;

  const encounterUuid = await saveFeedback(held);

  const store = loadStore();
  delete store[visitUuid];
  saveStore(store);
  return encounterUuid;
};

module.exports = { saveFeedback, holdFeedback, hasHeldFeedback, flushHeldFeedback };
