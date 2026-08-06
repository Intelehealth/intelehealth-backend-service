const express = require("express");
const { randomUUID } = require("crypto");
const { pushData, getOpenmrsId } = require("../lib/openmrs");
const {
  OPENMRS_LOCATION_UUID,
  OPENMRS_VISIT_TYPE_UUID,
  OPENMRS_ENCOUNTER_TYPE_ADULT_INITIAL,
  OPENMRS_ENCOUNTER_TYPE_VITALS,
  OPENMRS_ENCOUNTER_ROLE_UUID,
  OPENMRS_PROVIDER_UUID,
  OPENMRS_CONCEPT_VISIT_REASON,
  OPENMRS_CONCEPT_PHYSICAL_EXAM,
  OPENMRS_CONCEPT_MEDICAL_HISTORY,
  OPENMRS_CONCEPT_FAMILY_HISTORY,
  OPENMRS_CONCEPT_HEIGHT,
  OPENMRS_CONCEPT_WEIGHT,
  OPENMRS_VISIT_ATTR_SPECIALITY,
  OPENMRS_VISIT_ATTR_COMPLETE_DATETIME,
  OPENMRS_VISIT_ATTR_DOCTOR_NOTES,
} = require("../constants");

const formatDatetime = (d) => d.toISOString().replace("Z", "+0000");

// Treat unresolved Turn placeholders ("@results.foo") and blanks as missing.
const isBlank = (v) =>
  v == null || (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("@")));

const clean = (v, fallback = "") => (isBlank(v) ? fallback : String(v).trim());

const titleize = (s) =>
  String(s).replace(/_/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const humanize = (key, protocolId = "") => {
  let k = String(key);
  const prefix = protocolId ? `${protocolId}_` : "";
  if (prefix && k.startsWith(prefix)) k = k.slice(prefix.length);
  return titleize(k);
};

// "None wins": Flows can disable a checklist when "None" is ticked but can't
// clear earlier selections, so stale answers still arrive. When a marker
// (<proto>_no_<block> or <block>_none) is ticked, drop the rest of that block.
const applyNoneOverrides = (answers = {}) => {
  for (const key of Object.keys(answers)) {
    let prefix, block;
    const mPre = key.match(/^(.*?)no_(.+)$/);
    const mSuf = key.match(/^(.+?)_none$/);
    if (mPre) { prefix = mPre[1]; block = mPre[2]; }
    else if (mSuf) { prefix = ""; block = mSuf[1]; }
    else continue;

    const val = answers[key];
    const ticked = Array.isArray(val)
      ? val.length > 0
      : String(val || "").toLowerCase().includes("none");
    if (!ticked) continue;

    // "_factors" blocks also match the bare stem (relieving_medication etc).
    const stems = [block];
    if (block.endsWith("_factors")) stems.push(block.replace(/_factors$/, ""));

    for (const k of Object.keys(answers)) {
      // Keep the marker itself -- it renders as "None".
      if (k !== key && stems.some((s) => k.startsWith(prefix + s))) delete answers[k];
    }
  }
  return answers;
};

const answerRows = (protocolId, answers = {}) =>
  Object.entries(answers)
    .filter(([key]) => key !== "submitted" && key !== "flow_token")
    .map(([key, value]) => ({
      label: humanize(key, protocolId),
      value: clean(Array.isArray(value) ? value.join(", ") : value),
    }))
    .filter(({ value }) => !isBlank(value));

// Doctor-portal obs values are {en, "l-en"} JSON; markup mirrors the HW webapp
// (visit-upload.service.ts). en = display HTML, l-en = raw structured text.
// Rows -> the bullet markup both history obs share. `blankAs` fills empty
// values; when unset, blank rows are skipped instead.
const renderRows = (rows, blankAs) => {
  let displayHtml = "";
  let rawHtml = "";
  for (const { label, value } of rows) {
    const v = blankAs === undefined ? value : clean(value, blankAs);
    if (isBlank(v)) continue;
    displayHtml += `• ${label} - ${v}.<br/>`;
    rawHtml += `● ${label}<br/>•${v}<br/>`;
  }
  return { displayHtml, rawHtml };
};

const visitReasonObs = (complaintName, detailRows) => {
  const complaint = clean(complaintName, "Abdominal pain");
  let { displayHtml, rawHtml } = renderRows(detailRows);
  if (!displayHtml) {
    displayHtml = `• Symptom - ${complaint}.<br/>`;
    rawHtml = `● ${complaint}<br/>•${complaint}<br/>`;
  }
  return JSON.stringify({
    en: `►<b>${complaint}</b>: <br/>${displayHtml}`.trim(),
    "l-en": `►${complaint}::${rawHtml}`.trim(),
  });
};

const medicalHistoryObs = (rows) => {
  let { displayHtml, rawHtml } = renderRows(rows, "None");
  if (!displayHtml) {
    displayHtml = "• Medical History - None.<br/>";
    rawHtml = "● Do you have a history of any of the following?*<br/>•None<br/>";
  }
  return JSON.stringify({ en: displayHtml.trim(), "l-en": rawHtml.trim() });
};

const familyHistoryObs = (familyMembers) => {
  const summary = familyMembers.filter((f) => !isBlank(f)).join(", ") || "None";
  const q = "Do you have a family history of any of the following? :";
  return JSON.stringify({
    en: `${q} • ${summary}.<br/>`,
    "l-en": `${q} •${summary}.<br/>`,
  });
};

// Turn doesn't collect a structured physical exam -- send an empty obs so the
// doctor fills it in.
const physicalExamObs = () => JSON.stringify({ en: "", "l-en": "" });

// Build the /push/pushdata bundle, generating and cross-referencing UUIDs.
const buildPushBundle = (personUuid, protocolId, answers, patientHistory, familyHistory) => {
  const now = new Date();
  const encounterDatetime = formatDatetime(now);
  const visitCompleteDatetime = formatDatetime(new Date(now.getTime() + 1000));

  const r = answers || {};
  const ph = patientHistory || {};
  const fh = familyHistory || {};

  const complaintName = titleize(protocolId) || "Consultation";
  const visitReasonRows = answerRows(protocolId, answers);

  // Allergies: Turn sends `medication_allergy` (Yes/No) + `allergy_type` (the
  // drug) separately. Show the drug if allergic, else the Yes/No answer.
  const allergyValue =
    clean(ph.allergy_type ?? ph.allergy_other ?? r.allergies) ||
    clean(ph.medication_allergy ?? r.medication_allergy);

  // Turn's `risk_type` (e.g. "Smoking") feeds the smoking/tobacco rows when
  // risk_factors is Yes; explicit results.* keys win.
  const riskType = clean(ph.risk_type ?? ph.risk_other);
  const riskActive = clean(ph.risk_factors).toLowerCase() === "yes";
  const riskFor = (re) => (riskActive && re.test(riskType) ? riskType : "");
  const smokingValue = clean(r.smoking_history ?? r.smoking ?? riskFor(/smok/i));
  const tobaccoValue = clean(r.tobacco_status ?? r.chewing_tobacco ?? riskFor(/tobacco|chew/i));

  // The 8 canonical rows the doctor portal renders; blanks show as "None".
  // Turn nests these under `patient_history`; results.* keeps old payloads working.
  const medHistRows = [
    { label: "Current Vaccinations status", value: clean(r.vaccination_status ?? r.vaccinations) },
    { label: "Pregnancy status", value: clean(r.pregnancy_status ?? r.pregnancy) },
    { label: "Medical History", value: clean(ph.existing_conditions ?? r.medical_history ?? r.existing_conditions) },
    { label: "Drug history", value: clean(ph.current_medication ?? r.drug_history ?? r.current_medication ?? r.medication) },
    { label: "Allergies", value: allergyValue },
    { label: "Chewing tobacco status", value: tobaccoValue },
    { label: "Smoking history", value: smokingValue },
    { label: "Alcohol use", value: clean(r.alcohol_use ?? r.alcohol) },
  ];

  // Nested {fam_condition, fam_member} -> "Condition (Member)"; else the flat
  // comma/semicolon-separated r.family_history.
  const famCondition = clean(fh.fam_condition);
  const famMember = clean(fh.fam_member);
  const familyHistList = famCondition
    ? [famMember ? `${famCondition} (${famMember})` : famCondition]
    : clean(r.family_history).split(/[,;]+/).map((x) => x.trim()).filter(Boolean);

  // Vitals obs: only when Turn sent a value (CIEL 5090 height, 5089 weight).
  const obs = (concept, raw) => {
    const value = clean(raw);
    return value ? { concept, value, comments: "" } : null;
  };
  const vitalsObs = [
    obs(OPENMRS_CONCEPT_HEIGHT, r.body_height ?? r.height ?? r.height_cm),
    obs(OPENMRS_CONCEPT_WEIGHT, r.body_weight_value ?? r.body_weight ?? r.weight ?? r.weight_kg),
  ].filter(Boolean);

  const visitUuid = randomUUID();
  const withUuid = (list) => list.map((o) => ({ uuid: randomUUID(), ...o }));

  const baseEncounter = {
    encounterProviders: [{ encounterRole: OPENMRS_ENCOUNTER_ROLE_UUID, provider: OPENMRS_PROVIDER_UUID }],
    location: OPENMRS_LOCATION_UUID,
    patient: personUuid,
    visit: visitUuid,
    voided: 0,
  };

  return {
    appointments: [],
    providers: [],
    persons: [],
    patients: [],
    visits: [{
      uuid: visitUuid,
      patient: personUuid,
      location: OPENMRS_LOCATION_UUID,
      visitType: OPENMRS_VISIT_TYPE_UUID,
      startDatetime: encounterDatetime,
      attributes: [
        { attributeType: OPENMRS_VISIT_ATTR_SPECIALITY, value: "General Physician" },
        { attributeType: OPENMRS_VISIT_ATTR_COMPLETE_DATETIME, value: visitCompleteDatetime },
        { attributeType: OPENMRS_VISIT_ATTR_DOCTOR_NOTES, value: "No notes added for Doctor." },
      ],
    }],
    encounters: [
      {
        ...baseEncounter,
        uuid: randomUUID(),
        encounterDatetime,
        encounterType: OPENMRS_ENCOUNTER_TYPE_VITALS,
        obs: withUuid(vitalsObs),
      },
      {
        ...baseEncounter,
        uuid: randomUUID(),
        encounterDatetime,
        encounterType: OPENMRS_ENCOUNTER_TYPE_ADULT_INITIAL,
        obs: withUuid([
          { concept: OPENMRS_CONCEPT_VISIT_REASON, value: visitReasonObs(complaintName, visitReasonRows) },
          { concept: OPENMRS_CONCEPT_PHYSICAL_EXAM, value: physicalExamObs() },
          { concept: OPENMRS_CONCEPT_MEDICAL_HISTORY, value: medicalHistoryObs(medHistRows) },
          { concept: OPENMRS_CONCEPT_FAMILY_HISTORY, value: familyHistoryObs(familyHistList) },
        ]),
      },
    ],
  };
};

const router = express.Router();

router.post("/visit_push", async (req, res) => {
  console.log("\n[visit_push] received:", JSON.stringify(req.body, null, 2));
  try {
    const personUuid = req.body.patient_uuid;
    if (isBlank(personUuid)) {
      return res.status(400).json({ success: false, error: "patient_uuid is required" });
    }

    // Dynamic shape { protocol_id, answers }; older shapes kept as fallbacks.
    const protocolId = clean(req.body.protocol_id || req.body.symptom);
    const answers = applyNoneOverrides({
      ...(req.body.answers || req.body.symptoms_data || req.body.results || {}),
    });
    const patientHistory = applyNoneOverrides({ ...(req.body.patient_history || {}) });
    const familyHistory = req.body.family_history || {};

    const bundle = buildPushBundle(
      personUuid, protocolId, answers, patientHistory, familyHistory
    );

    const { data } = await pushData(bundle);
    console.log("[visit_push] pushdata response:", JSON.stringify(data));

    // Visit is already saved, so a failed ID lookup must not fail the push.
    let openmrsId = "";
    try {
      openmrsId = await getOpenmrsId(personUuid);
    } catch (idErr) {
      console.error("[visit_push] openmrs id lookup failed:", idErr.response?.data || idErr.message);
    }

    res.json({
      success: true,
      visit_uuid: bundle.visits[0].uuid,
      visit_id: bundle.visits[0].uuid,
      patient_uuid: personUuid,
      openmrs_id: openmrsId,
      encounter_uuids: bundle.encounters.map((e) => e.uuid),
    });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("[visit_push] error:", detail);
    res.status(500).json({ success: false, error: detail });
  }
});

module.exports = router;