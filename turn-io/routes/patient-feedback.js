const express = require("express");
const { getVisitEncounterTypes } = require("../lib/openmrs");
const { saveFeedback, holdFeedback } = require("../lib/feedback");
const {
  OPENMRS_ENCOUNTER_TYPE_PATIENT_EXIT_SURVEY,
  OPENMRS_ENCOUNTER_TYPE_VISIT_COMPLETE,
} = require("../constants");

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
    // The Turn journey encodes line breaks in the comment as "[NL]"; restore them.
    feedback: clean(src.feedback_comment ?? src.comment ?? src.comments).replaceAll("[NL]", "\n").trim(),
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

    let encounterTypes;
    try {
      encounterTypes = await getVisitEncounterTypes(visitUuid);
    } catch (err) {
      const status = err.response?.status;
      console.error(`[feedback_push] could not read visit ${visitUuid}:`, status || err.message);
      if (status === 404) {
        return res.status(404).json({ success: false, error: "visit not found" });
      }
      return res.status(502).json({ success: false, error: "could not verify visit status" });
    }
    if (encounterTypes.includes(OPENMRS_ENCOUNTER_TYPE_PATIENT_EXIT_SURVEY)) {
      console.warn(`[feedback_push] rejected: visit ${visitUuid} already has feedback`);
      return res.status(409).json({ success: false, error: "feedback already recorded for this visit" });
    }

    const result = { success: true, patient_uuid: personUuid, visit_uuid: visitUuid, rating, feedback_saved: Boolean(feedback) };

    // The doctor portal treats an exit survey as "visit ended" and hides "Start visit note",
    // so hold the rating until the prescription is shared (see prescription/route.js).
    if (!encounterTypes.includes(OPENMRS_ENCOUNTER_TYPE_VISIT_COMPLETE)) {
      holdFeedback({ personUuid, visitUuid, rating, feedback });
      console.log(`[feedback_push] held for visit ${visitUuid} until the prescription is shared`);
      return res.json({ ...result, held: true });
    }

    const encounterUuid = await saveFeedback({ personUuid, visitUuid, rating, feedback });
    res.json({ ...result, held: false, encounter_uuid: encounterUuid });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("[feedback_push] error:", detail);
    res.status(500).json({ success: false, error: detail });
  }
});

module.exports = router;
