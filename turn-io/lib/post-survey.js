// Post-consultation survey (IDTP-177): 86B answers, stored like the case summary in
// visit-push.js: one Text obs whose value is a JSON string, on its own encounter
// attached to the visit the prescription was shared on.

const { randomUUID } = require("crypto");
const { pushData, getEncounter } = require("./openmrs");
const {
  OPENMRS_LOCATION_UUID,
  OPENMRS_ENCOUNTER_ROLE_UUID,
  OPENMRS_PROVIDER_UUID,
  OPENMRS_ENCOUNTER_TYPE_POST_CONSULTATION_SURVEY,
  OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY,
} = require("../constants");

// Mirrors arogyapath_post_consultation_feedback_v3: option numbers run 1-12 across
// the four questions, so every reply number maps to exactly one answer.
const QUESTIONS = [
  {
    key: "q1", topic: "Medication",
    question: "क्या आपने डॉक्टर की बताई दवा ली?",
    question_en: "Did you take the medicine the doctor prescribed?",
    options: {
      1: ["हाँ, पूरी ली", "Yes, took it fully"],
      2: ["कुछ दिन ली, फिर छोड़ दी", "Took it for a few days, then stopped"],
      3: ["नहीं ली", "Did not take it"],
    },
  },
  {
    key: "q2", topic: "Medication",
    question: "आपने दवाइयाँ कहाँ से ली हैं?",
    question_en: "Where did you get the medicines?",
    options: {
      4: ["आयुष्मान आरोग्य मंदिर", "Ayushman Arogya Mandir"],
      5: ["प्राइवेट मेडिकल स्टोर", "Private medical store"],
      6: ["Other", "Other"], // + free text (q2_other)
    },
  },
  {
    key: "q3", topic: "Referral",
    question: "क्या आप स्वास्थ्य केंद्र (Ayushman Arogya Mandir / अस्पताल) गए?",
    question_en: "Did you go to the health centre (Ayushman Arogya Mandir / hospital)?",
    options: {
      7: ["हाँ, गए और जाँच/इलाज हुआ", "Yes, went and got tested/treated"],
      8: ["गए, पर जाँच/इलाज नहीं हुआ", "Went, but was not tested/treated"],
      9: ["अभी तक नहीं गए", "Have not gone yet"],
    },
  },
  {
    key: "q4", topic: "Follow up",
    question: "क्या आपने बताए दिन पर दोबारा डॉक्टर से बात की?",
    question_en: "Did you speak to the doctor again on the advised day?",
    options: {
      10: ["हाँ", "Yes"],
      11: ["नहीं", "No"],
      12: ["अभी दिन नहीं आया", "The day has not come yet"],
    },
  },
];

const isBlank = (v) =>
  v == null || (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@")));
const clean = (v) => (isBlank(v) ? "" : String(v).trim());

// WhatsApp Flow "FEEDBACKPOST" (1689422779483898) radio option ids -> option number,
// exactly as in the Flow JSON (q1_meds_taken, q2_meds_source, q3_health_center,
// q4_followup_call). Keep in sync if the Flow's option ids change.
const FLOW_IDS = {
  q1: { full: 1, some_days: 2, no: 3 },
  q2: { arogya_mandir: 4, private_store: 5, other: 6 },
  q3: { visited_treated: 7, visited_not_treated: 8, not_yet: 9 },
  q4: { yes: 10, no: 11, day_not_yet: 12 },
};

// Accepts a Flow option id (see FLOW_IDS), the template's own number (q3 = 7..9),
// or the position within the question (q3 = 1..3).
const resolveOption = (q, raw) => {
  const value = clean(raw);
  const byId = FLOW_IDS[q.key]?.[value.toLowerCase()];
  if (byId) return byId;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  const numbers = Object.keys(q.options).map(Number);
  if (numbers.includes(n)) return n;
  if (n >= 1 && n <= numbers.length) return numbers[n - 1];
  return null;
};

// { q1, q2, q2_other, q3, q4 } -> answer rows; unanswered/invalid questions are
// kept with option null so the stored JSON always lists all four questions.
const parseAnswers = (src = {}) =>
  QUESTIONS.map((q) => {
    const option = resolveOption(q, src[q.key]);
    const [answer, answer_en] = option ? q.options[option] : [null, null];
    const row = {
      q: q.key.toUpperCase(), topic: q.topic, question: q.question, question_en: q.question_en,
      option, answer, answer_en, raw: clean(src[q.key]) || null, // raw = exactly what the Flow sent
    };
    if (q.key === "q2" && option === 6) row.other_text = clean(src.q2_other) || null;
    return row;
  });

const formatDatetime = (d) => d.toISOString().replace("Z", "+0000");

// Writes the survey encounter; returns { encounterUuid, value } (value = the stored JSON).
const saveSurveyResponse = async ({ personUuid, visitUuid, answers, meta = {} }) => {
  const answeredAt = new Date();
  const value = JSON.stringify({
    survey: "post_consultation",
    template: meta.template || null,
    prescription_date: meta.prescriptionDate || null,
    sent_at: meta.sentAt || null,
    answered_at: answeredAt.toISOString(),
    answers,
  });

  // No visits[] entry: the visit exists, and re-posting would overwrite its attributes.
  const encounterUuid = randomUUID();
  const bundle = {
    appointments: [], providers: [], persons: [], patients: [], visits: [],
    encounters: [{
      uuid: encounterUuid,
      encounterDatetime: formatDatetime(answeredAt),
      encounterType: OPENMRS_ENCOUNTER_TYPE_POST_CONSULTATION_SURVEY,
      encounterProviders: [{ encounterRole: OPENMRS_ENCOUNTER_ROLE_UUID, provider: OPENMRS_PROVIDER_UUID }],
      location: OPENMRS_LOCATION_UUID,
      patient: personUuid,
      visit: visitUuid,
      voided: 0,
      obs: [{ uuid: randomUUID(), concept: OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY, value, comments: "" }],
    }],
  };

  console.log(`[post-survey] OBS VALUE (what gets stored in obs.value_text):\n${JSON.stringify(JSON.parse(value), null, 2)}`);
  console.log(`[post-survey] encounter ${encounterUuid} -> type ${OPENMRS_ENCOUNTER_TYPE_POST_CONSULTATION_SURVEY}, ` +
    `visit ${visitUuid}, patient ${personUuid}, obs concept ${OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY}`);
  console.log(`[post-survey] pushData -> ${process.env.EMR_MIDDLEWARE_PUSHDATA_URL}`);
  console.log("[post-survey] bundle:", JSON.stringify(bundle));

  const { data, status } = await pushData(bundle);
  console.log(`[post-survey] middleware ${status}:`, JSON.stringify(data));

  const verified = await verifySaved(encounterUuid);
  return { encounterUuid, value, verified };
};

// Reads the encounter back from OpenMRS and logs what is actually stored. The
// middleware has answered "OK" before without saving, so this is the real proof.
const verifySaved = async (encounterUuid) => {
  let enc;
  try {
    enc = await getEncounter(encounterUuid);
  } catch (err) {
    console.error(`[post-survey] VERIFY could not read encounter ${encounterUuid}:`, JSON.stringify(err.response?.data || err.message));
    return { saved: null, error: "could not read back from OpenMRS" };
  }
  if (!enc) {
    console.error(`[post-survey] VERIFY FAILED: encounter ${encounterUuid} is NOT in OpenMRS (${process.env.OPENMRS_REST_URL}) ` +
      "-- the middleware said OK but did not save it");
    return { saved: false };
  }

  const obs = (enc.obs || []).find((o) => o.concept?.uuid === OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY && !o.voided);
  console.log(`[post-survey] VERIFY OK: encounter ${enc.uuid} "${enc.encounterType?.display}" on visit ${enc.visit?.uuid}, ` +
    `patient "${enc.patient?.display}", ${enc.encounterDatetime}`);
  if (!obs) {
    console.error(`[post-survey] VERIFY FAILED: encounter saved but has NO survey obs (concept ${OPENMRS_CONCEPT_POST_CONSULTATION_SURVEY}) ` +
      "-- does that concept exist on this server?");
    return { saved: false, encounter_uuid: enc.uuid, error: "survey obs missing" };
  }
  console.log(`[post-survey] VERIFY OK: obs ${obs.uuid} concept "${obs.concept?.display}" value_text (${String(obs.value).length} chars):\n${obs.value}`);
  return { saved: true, encounter_uuid: enc.uuid, obs_uuid: obs.uuid, encounter_type: enc.encounterType?.display };
};

module.exports = { QUESTIONS, parseAnswers, saveSurveyResponse };
