// Post-consultation survey (IDTP-177): receives the patient's Flow answers from Turn and stores them in OpenMRS.
const express = require("express");
const { getVisitContents } = require("../lib/openmrs");
const { parseAnswers, saveSurveyResponse } = require("../lib/post-survey");
const { findSurveyForPhone, markSurveyAnswered } = require("../prescription/survey-cron");
const { OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY } = require("../constants");

// An unset Turn contact/result field arrives as the literal "@contact.foo" template.
const isBlank = (v) =>
  v == null || (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@")));
const clean = (v) => (isBlank(v) ? "" : String(v).trim());

const router = express.Router();

// Turn journey posts the patient's answers to the 86B post-consultation survey.
// Body: { whatsapp_id, q1, q2, q2_other?, q3, q4, visit_uuid?, patient_uuid? }
// q1..q4 are the reply numbers (template numbering 1-12, or 1-3 per question).
// The visit comes from the survey sent-log by phone unless visit_uuid is given.
router.post("/survey_response", async (req, res) => {
  console.log("\n[survey_response] ---- start ----");
  console.log("[survey_response] received:", JSON.stringify(req.body, null, 2));
  try {
    const b = req.body || {};
    const phone = clean(b.whatsapp_id || b.mobile || b.phone);
    const sent = phone ? findSurveyForPhone(phone) : null;
    console.log(`[survey_response] sent-log lookup for ${phone || "(no phone)"}:`,
      sent ? JSON.stringify(sent) : "no survey sent to this number");

    const visitUuid = clean(b.visit_uuid) || sent?.visitUuid || "";
    const personUuid = clean(b.patient_uuid) || sent?.patient_uuid || "";
    console.log(`[survey_response] visit = ${visitUuid || "-"} (${clean(b.visit_uuid) ? "from body" : "from sent-log"}), ` +
      `patient = ${personUuid || "-"} (${clean(b.patient_uuid) ? "from body" : "from sent-log"})`);
    if (!visitUuid || !personUuid) {
      console.warn(`[survey_response] REJECTED: no survey found for ${phone || "(no phone)"}`);
      return res.status(404).json({ success: false, error: "no survey was sent to this number (pass visit_uuid + patient_uuid)" });
    }

    const answers = parseAnswers(b);
    for (const a of answers) {
      console.log(`[survey_response] ${a.q}: raw=${JSON.stringify(b[a.q.toLowerCase()] ?? null)} -> option ${a.option ?? "-"}` +
        ` "${a.answer_en ?? "(no answer)"}"${a.other_text ? ` other="${a.other_text}"` : ""}`);
    }
    if (!answers.some((a) => a.option)) {
      console.warn("[survey_response] REJECTED: no valid answers in q1..q4");
      return res.status(400).json({ success: false, error: "no valid answers in q1..q4", answers });
    }

    // One response per visit: a repeat reply must not create a second encounter.
    // Checked by concept -- the encounter type is shared with the rating's exit survey.
    let obsConcepts;
    try {
      ({ obsConcepts } = await getVisitContents(visitUuid));
    } catch (err) {
      const status = err.response?.status;
      console.error(`[survey_response] could not read visit ${visitUuid}:`, status || err.message);
      return res.status(status === 404 ? 404 : 502).json({
        success: false, error: status === 404 ? "visit not found" : "could not verify visit",
      });
    }
    console.log(`[survey_response] visit ${visitUuid} has ${obsConcepts.length} obs; survey already stored: ` +
      obsConcepts.includes(OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY));
    if (obsConcepts.includes(OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY)) {
      console.warn(`[survey_response] rejected: visit ${visitUuid} already has a survey response`);
      return res.status(409).json({ success: false, error: "survey already answered for this visit", visit_uuid: visitUuid });
    }

    const { encounterUuid, verified } = await saveSurveyResponse({
      personUuid, visitUuid, answers,
      meta: { template: sent?.template, prescriptionDate: sent?.prescription_date, sentAt: sent?.sent_at },
    });
    // A failed write stays unanswered, so the patient's retry is accepted.
    if (sent?.visitUuid === visitUuid && verified.saved !== false) markSurveyAnswered(visitUuid, { encounterUuid });

    console.log(`[survey_response] ---- done ---- visit ${visitUuid} encounter ${encounterUuid} ` +
      `stored in OpenMRS: ${verified.saved === true ? "YES" : verified.saved === false ? "NO" : "UNKNOWN"}`);
    res.status(verified.saved === false ? 502 : 200).json({
      success: verified.saved !== false, visit_uuid: visitUuid, patient_uuid: personUuid, encounter_uuid: encounterUuid,
      stored_in_openmrs: verified,
      answers: answers.map(({ q, option, answer_en, other_text }) => ({ q, option, answer_en, ...(other_text ? { other_text } : {}) })),
    });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("[survey_response] error:", detail);
    res.status(500).json({ success: false, error: detail });
  }
});

module.exports = router;
