const express = require("express");
const { randomUUID } = require("crypto");
const { pushData } = require("../lib/openmrs");

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

// Turn's abdominal-pain journey sends answers nested under `abdominal_pain`.
// Each entry maps one payload key -> the label shown under the Chief Complaint,
// in display order.
const ABD_PAIN_FIELDS = [
   ["start_time",               "Pain started"],
   ["hours",                    "Duration (hours)"],
   ["days",                     "Duration (days)"],
   ["weeks",                    "Duration (weeks)"],
   ["onset",                    "Onset"],
   ["location",                 "Location"],
   ["site",                     "Site"],
   ["site_more",                "Site (more)"],
   ["character",                "Character"],
   ["severity",                 "Severity"],
   ["relieving_factors",        "Relieving factors"],
   ["aggravating_factors",      "Aggravating factors"],
   ["progression",              "Progression"],
   ["constant_intermittent",    "Constant / intermittent"],
   ["diurnal_variation",        "Diurnal variation"],
   ["radiates",                 "Radiates"],
   ["radiates_to",              "Radiates to"],
   ["radiates_to_2",            "Radiates to (2)"],
   ["radiates_to_3",            "Radiates to (3)"],
   ["assoc_distention",         "Associated: distention"],
   ["assoc_vomiting",           "Associated: vomiting"],
   ["vomit_character",          "Vomit character"],
   ["assoc_belching",           "Associated: belching"],
   ["assoc_heartburn",          "Associated: heartburn"],
   ["assoc_jaundice",           "Associated: jaundice"],
   ["assoc_constipation",       "Associated: constipation"],
   ["assoc_diarrhea",           "Associated: diarrhea"],
   ["assoc_blood_stools",       "Associated: blood in stools"],
   ["assoc_black_stools",       "Associated: black stools"],
   ["assoc_loss_appetite",      "Associated: loss of appetite"],
   ["assoc_increased_appetite", "Associated: increased appetite"],
   ["assoc_weight_loss",        "Associated: weight loss"],
   ["assoc_injury_abdomen",     "Associated: injury to abdomen"],
];

const symptomDetailRows = (obj = {}) =>
   ABD_PAIN_FIELDS.map(([key, label]) => ({ label, value: clean(obj[key]) }));

// Doctor-portal obs values are {en, "l-en"} JSON; markup mirrors the HW webapp
// (visit-upload.service.ts). en = display HTML, l-en = raw structured text.
const visitReasonObs = (complaintName, detailRows) => {
   const complaint = clean(complaintName, "Abdominal pain");
   let displayHtml = "";
   let rawHtml = "";
   for (const { label, value } of detailRows) {
      if (isBlank(value)) continue;
      displayHtml += `• ${label} - ${value}.<br/>`;
      rawHtml += `● ${label}<br/>•${value}<br/>`;
   }
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
   let displayHtml = "";
   let rawHtml = "";
   for (const { label, value } of rows) {
      const v = clean(value, "None");
      displayHtml += `• ${label} - ${v}.<br/>`;
      rawHtml += `● ${label}<br/>•${v}<br/>`;
   }
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

// Build the EMR-Middleware /push/pushdata bundle from a Turn webhook body.
// Generates UUIDs for the visit/encounters/obs and cross-references them.
const buildPushBundle = (personUuid, symptom, results, symptomData, patientHistory, familyHistory) => {
   const now = new Date();
   const encounterDatetime = formatDatetime(now);
   const visitCompleteDatetime = formatDatetime(new Date(now.getTime() + 1000));

   const r = results || {};
   const s = symptomData || {};
   const ph = patientHistory || {};
   const fh = familyHistory || {};

   // Chief Complaint badge + detail rows. When Turn sends the nested
   // `abdominal_pain` object, its fields are the rows; otherwise fall back to
   // the flat `results.*` fields (older flows).
   const complaintName = clean(r.main_problem, symptom);
   const visitReasonRows = symptomData
      ? symptomDetailRows(symptomData)
      : [
         { label: "Other problems",           value: clean(r.other_problem) },
         { label: "Looking consultation for", value: clean(r.looking_consultation_for) },
         { label: "Relationship",             value: clean(r.relationship) },
         { label: "Visit type",               value: clean(r.visit_type) },
         { label: "Occupation",               value: clean(r.occupation) },
         { label: "Village / Address",        value: clean(r.village_address) },
         { label: "District / Town",          value: clean(r.district_town) },
      ];

   // Allergies: Turn sends `medication_allergy` (Yes/No) + `allergy_type` (the
   // drug) separately. Show the drug if allergic, else the Yes/No answer.
   const allergyValue = (() => {
      const type = clean(ph.allergy_type ?? ph.allergy_other ?? r.allergies);
      if (!isBlank(type)) return type;
      return clean(ph.medication_allergy ?? r.medication_allergy);
   })();

   // Risk factors (Turn's `risk_type`, e.g. "Smoking") feed both the smoking and
   // chewing-tobacco rows when relevant; otherwise the explicit results.* keys.
   const riskType = clean(ph.risk_type ?? ph.risk_other);
   const riskActive = clean(ph.risk_factors).toLowerCase() === "yes";
   const smokingValue = clean(
      r.smoking_history ?? r.smoking ??
      (riskActive && /smok/i.test(riskType) ? riskType : "")
   );
   const tobaccoValue = clean(
      r.tobacco_status ?? r.chewing_tobacco ??
      (riskActive && /tobacco|chew/i.test(riskType) ? riskType : "")
   );

   // Medical-history rows mirror the 8 canonical rows the doctor portal renders.
   // Blank values render as "None". Turn nests these under `patient_history`
   // (ph.*); results.* aliases keep older flat payloads working.
   const medHistRows = [
      { label: "Current Vaccinations status", value: clean(r.vaccination_status ?? r.vaccinations) },
      { label: "Pregnancy status",            value: clean(r.pregnancy_status ?? r.pregnancy) },
      { label: "Medical History",             value: clean(ph.existing_conditions ?? r.medical_history ?? r.existing_conditions) },
      { label: "Drug history",                value: clean(ph.current_medication ?? r.drug_history ?? r.current_medication ?? r.medication) },
      { label: "Allergies",                   value: allergyValue },
      { label: "Chewing tobacco status",      value: tobaccoValue },
      { label: "Smoking history",             value: smokingValue },
      { label: "Alcohol use",                 value: clean(r.alcohol_use ?? r.alcohol) },
   ];

   // Family history: Turn nests it under `family_history` as
   // {fam_history_present, fam_condition, fam_member}. Build a "Condition
   // (Member)" entry when a condition is present; fall back to flat r.family_history.
   const familyHistList = (() => {
      const condition = clean(fh.fam_condition);
      if (!isBlank(condition)) {
         const member = clean(fh.fam_member);
         return [member ? `${condition} (${member})` : condition];
      }
      return String(clean(r.family_history))
         .split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
   })();

   // Vitals obs: included only when Turn sent a value. Concept UUIDs mirror the
   // HW reference (CIEL 5090 height, 5089 weight). Height/weight may arrive on
   // `results` or nested in the symptom object -- check both.
   const obs = (concept, raw) => {
      const value = clean(raw);
      return value ? { concept, value, comments: "" } : null;
   };
   const vitalsObs = [
      obs(OPENMRS_CONCEPT_HEIGHT,
         r.body_height ?? r.height ?? r.height_cm ?? s.body_height ?? s.height ?? s.height_cm),
      obs(OPENMRS_CONCEPT_WEIGHT,
         r.body_weight_value ?? r.body_weight ?? r.weight ?? r.weight_kg ??
         s.body_weight_value ?? s.body_weight ?? s.weight ?? s.weight_kg),
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
               { concept: OPENMRS_CONCEPT_VISIT_REASON,    value: visitReasonObs(complaintName, visitReasonRows) },
               { concept: OPENMRS_CONCEPT_PHYSICAL_EXAM,   value: physicalExamObs() },
               { concept: OPENMRS_CONCEPT_MEDICAL_HISTORY, value: medicalHistoryObs(medHistRows) },
               { concept: OPENMRS_CONCEPT_FAMILY_HISTORY,  value: familyHistoryObs(familyHistList) },
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

      const symptom = req.body.symptom || "Abdominal pain";
      const results = req.body.results || {};
      const symptomData = req.body.abdominal_pain || null;
      const patientHistory = req.body.patient_history || {};
      const familyHistory = req.body.family_history || {};

      const bundle = buildPushBundle(
         personUuid, symptom, results, symptomData, patientHistory, familyHistory
      );
      const { data } = await pushData(bundle);
      console.log("[visit_push] pushdata response:", JSON.stringify(data));

      res.json({
         success: true,
         visit_uuid: bundle.visits[0].uuid,
         encounter_uuids: bundle.encounters.map((e) => e.uuid),
      });
   } catch (err) {
      const detail = err.response?.data || err.message;
      console.error("[visit_push] error:", detail);
      res.status(500).json({ success: false, error: detail });
   }
});

module.exports = router;
