const express = require("express");
const { getVisitContents } = require("../lib/openmrs");
const { saveFeedback } = require("../lib/feedback");
const { OPENMRS_CONCEPT_RATING } = require("../constants");

// An unset Turn contact field arrives as the literal "@contact.foo" template, and an
// unanswered optional Flow field can arrive as the literal "${form.foo}".
const isBlank = (v) =>
  v == null ||
  (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@") || v.trim().startsWith("${")));

const clean = (v, fallback = "") => (isBlank(v) ? fallback : String(v).trim());

// The Flow sends a number, older text journeys a string; stored as a string.
const parseRating = (raw) => {
  const value = clean(raw);
  return /^[1-5]$/.test(value) ? value : "";
};

// Feedback Flow radio questions: option ids -> English labels, exactly as in the
// Flow JSON. Keep in sync if the Flow's option ids change.
const SURVEY_QUESTIONS = {
  technical_difficulty: {
    none: "No, I did not face any difficulty",
    connectivity: "Internet or network connectivity",
    slow_loading: "Messages or questions were taking too long to load",
    sending_selecting: "Difficulty sending responses or selecting options",
    whatsapp_phone_use: "Difficulty using WhatsApp or the phone",
    other: "Other",
  },
  question_comprehension: {
    easy: "I understood all or most questions and could answer them easily.",
    some_difficulty: "I understood some questions but had difficulty understanding or answering others.",
    needed_help: "I had difficulty answering them or had to take someone's help",
    cannot_say: "Cannot say / Do not remember",
  },
  comfort_sharing_info: {
    comfortable: "I felt comfortable sharing all the information asked",
    somewhat_hesitant: "I felt hesitant to share some information.",
    not_comfortable: "I did not feel comfortable sharing my health information",
    cannot_say: "Cannot say / Do not remember",
  },
  time_effort: {
    reasonable: "It took a reasonable amount of time and effort",
    more_than_preferred: "It took more time or effort than I would have preferred",
    too_much: "It took too much time or effort",
    cannot_say: "Cannot say / Do not remember",
  },
};

// { technical_difficulty: { id, answer, other? }, ... } for the questions answered;
// an id the Flow no longer defines is kept with answer null so nothing is lost.
const parseSurveyAnswers = (src) => {
  const answers = {};
  for (const [key, options] of Object.entries(SURVEY_QUESTIONS)) {
    const id = clean(src[key]);
    if (!id) continue;
    answers[key] = { id, answer: options[id] ?? null };
  }
  const other = clean(src.technical_difficulty_other);
  if (other && answers.technical_difficulty?.id === "other") answers.technical_difficulty.other = other;
  return answers;
};

// Turn unwraps the Flow's nfm_reply, so `feedback` arrives flat (or stringified).
const readSurvey = (body) => {
  let fb = body.feedback;
  if (typeof fb === "string" && fb.trim().startsWith("{")) {
    try { fb = JSON.parse(fb); } catch { fb = null; }
  }
  const src = fb && typeof fb === "object" ? fb : body;

  // The Turn journey encodes line breaks in the comment as "[NL]"; restore them.
  const comment = clean(src.feedback_comment ?? src.comment ?? src.comments).replaceAll("[NL]", "\n").trim();
  const answers = parseSurveyAnswers(src);

  // Stored in the existing feedback (comments) obs. Old journeys send only a comment,
  // which stays plain text; the survey Flow stores the comment plus its answers as JSON.
  const feedback = Object.keys(answers).length
    ? JSON.stringify({ survey: "patient_feedback", v: 1, comment: comment || null, answers })
    : comment;

  return { rating: parseRating(src.feedback_rating ?? src.rating), feedback };
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

    let obsConcepts, stopDatetime;
    try {
      ({ obsConcepts, stopDatetime } = await getVisitContents(visitUuid));
    } catch (err) {
      const status = err.response?.status;
      console.error(`[feedback_push] could not read visit ${visitUuid}:`, status || err.message);
      if (status === 404) {
        return res.status(404).json({ success: false, error: "visit not found" });
      }
      return res.status(502).json({ success: false, error: "could not verify visit status" });
    }
    // Post-consultation survey (IDTP-177): check the rating concept, since survey answers share the exit-survey encounter.
    if (obsConcepts.includes(OPENMRS_CONCEPT_RATING)) {
      console.warn(`[feedback_push] rejected: visit ${visitUuid} already has feedback`);
      return res.status(409).json({ success: false, error: "feedback already recorded for this visit" });
    }

    const result = { success: true, patient_uuid: personUuid, visit_uuid: visitUuid, rating, feedback_saved: Boolean(feedback) };

    // Saved straight away, even before the doctor shares the prescription: on Turn the doctor
    // portal (IS_TURN_SERVER) no longer treats an exit survey as "visit ended" -- only the
    // visit's stopDatetime, set when the doctor shares, ends it.
    // If the visit has already ended, date the encounter just before its stop time:
    // OpenMRS rejects an encounter dated after its visit's stopDatetime.
    const encounterDatetime = stopDatetime ? new Date(new Date(stopDatetime).getTime() - 1000) : undefined;
    const encounterUuid = await saveFeedback({ personUuid, visitUuid, rating, feedback, encounterDatetime });
    console.log(`[feedback_push] saved for visit ${visitUuid} as encounter ${encounterUuid}${stopDatetime ? " (visit already ended)" : ""}`);
    res.json({ ...result, held: false, encounter_uuid: encounterUuid });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("[feedback_push] error:", detail);
    res.status(500).json({ success: false, error: detail });
  }
});

module.exports = router;
