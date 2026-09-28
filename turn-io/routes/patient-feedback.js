const express = require("express");
const { randomUUID } = require("crypto");
const { pushData } = require("../lib/openmrs");
const {
  OPENMRS_LOCATION_UUID,
  OPENMRS_ENCOUNTER_TYPE_PATIENT_EXIT_SURVEY,
  OPENMRS_ENCOUNTER_ROLE_UUID,
  OPENMRS_PROVIDER_UUID,
  OPENMRS_CONCEPT_RATING,
  OPENMRS_CONCEPT_COMMENTS,
} = require("../constants");

const formatDatetime = (d) => d.toISOString().replace("Z", "+0000");

// An unset Turn contact field arrives as the literal "@contact.foo" template.
const isBlank = (v) =>
  v == null || (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@")));

const clean = (v, fallback = "") => (isBlank(v) ? fallback : String(v).trim());

// The Flow sends a number, older text journeys a string; stored as a string.
const parseRating = (raw) => {
  const value = clean(raw);
  return /^[1-5]$/.test(value) ? value : "";
};

// Turn unwraps the Flow's nfm_reply, so `feedback` arrives flat (or stringified).
const readSurvey = (body) => {
  let fb = body.feedback;
  if (typeof fb === "string" && fb.trim().startsWith("{")) {
    try { fb = JSON.parse(fb); } catch { fb = null; }
  }
  const src = fb && typeof fb === "object" ? fb : body;

  return {
    rating: parseRating(src.feedback_rating ?? src.rating),
    feedback: clean(src.feedback_comment ?? src.comments),
  };
};

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

const router = express.Router();

router.post("/feedback_push", async (req, res) => {
  console.log("\n[feedback_push] received:", JSON.stringify(req.body, null, 2));
  try {
    const personUuid = clean(req.body.patient_uuid);
    const visitUuid = clean(req.body.visit_uuid);
    if (!personUuid) {
      return res.status(400).json({ success: false, error: "patient_uuid is required" });
    }
    // A visit-less encounter would be orphaned and never surface in the portal.
    if (!visitUuid) {
      return res.status(400).json({ success: false, error: "visit_uuid is required" });
    }

    const { rating, feedback } = readSurvey(req.body);
    if (!rating) {
      return res.status(400).json({ success: false, error: "feedback_rating must be a number from 1 to 5" });
    }

    const bundle = buildSurveyBundle({ personUuid, visitUuid, rating, feedback });

    const { data } = await pushData(bundle);
    console.log("[feedback_push] pushdata response:", JSON.stringify(data));

    res.json({
      success: true,
      patient_uuid: personUuid,
      visit_uuid: visitUuid,
      encounter_uuid: bundle.encounters[0].uuid,
      rating,
      feedback_saved: Boolean(feedback),
    });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("[feedback_push] error:", detail);
    res.status(500).json({ success: false, error: detail });
  }
});

module.exports = router;
