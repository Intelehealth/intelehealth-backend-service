// Extract a prescription from an OpenMRS visit. Ported from the HW webapp
// (visit-prescription.service.ts) so the PDF renders the same fields the doctor
// portal shows: patient, doctor, vitals, diagnosis, medicines, advice, tests,
// referrals and follow-up.

const CONCEPT = {
   // Chief-complaint / current-complaint obs (what visit_push writes as the
   // visit reason, and what the doctor portal reads as CURRENT_COMPLAINT).
   VISIT_REASON: "3edb0e09-9135-481e-b8f0-07a26fa9a5ce",
   DIAGNOSIS: "537bb20d-d09d-4f88-930b-cc45c7d662df",
   MEDICATION: "c38c0c50-2fd2-4ae3-b7ba-7dd25adca4ca",
   ADVICE: "67a050c1-35e5-451c-a4ab-fff9d57b0db1",
   TEST: "23601d71-50e6-483f-968d-aeef3031346d",
   REFERRAL: "605b6f15-8f7a-4c45-b06d-14165f6974be",
   FOLLOW_UP: "e8caffd6-5d22-41c4-8d6a-bc31a44d0c86",
   HEIGHT: "5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   WEIGHT: "5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   BP_SYSTOLIC: "5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   BP_DIASTOLIC: "5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   PULSE: "5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   TEMPERATURE: "5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   SPO2: "5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   RESPIRATORY_RATE: "5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

// Encounter type the doctor portal writes when it clicks "Share Prescription"
// (visit-summary.component.ts). Its presence is the explicit "shared" signal.
const VISIT_COMPLETE_ENCOUNTER_TYPE = "bd1fbfaa-f5fb-4ebd-b75c-564506fc309e";

const IDENTIFIER_OPENMRS_ID = "OpenMRS ID";
const PERSON_ATTR = {
   TELEPHONE: "Telephone Number",
   NATIONAL_ID: "National ID",
   OCCUPATION: "Occupation",
};
const PROVIDER_ATTR = {
   SIGNATURE: "signature",
   QUALIFICATION_CERTIFICATE: "qualificationcertificate",
   QUALIFICATION: "qualification",
   TYPE_OF_PROFESSION: "typeofprofession",
   REGISTRATION_NUMBER: "registrationnumber",
   REGISTRATION_NUMBER_ALT: "registration number",
};

const getPersonAttribute = (person, display) =>
   person?.attributes?.find((a) => a.attributeType?.display === display)?.value ?? null;

const obsStr = (o) => String(o.value || o.display || "");

// Parse the visit-reason / current-complaint obs into chief-complaint sections.
// visit_push writes the display value as:
//   ►<b>Fever</b>: <br/>• Onset - Sudden.<br/>• Severity - High.<br/>...
// The doctor portal splits on <b> to get complaint names; we additionally pull
// out the "• Label - value" detail lines. Returns:
//   [{ complaint: "Fever", details: [{ label, value }] }]
const parseChiefComplaint = (raw) => {
   const text = String(raw || "");
   if (!text.trim()) return [];
   // Each complaint block starts with a bold name.
   const blocks = text.split("<b>").filter((b) => b.includes("</b>"));
   const sections = [];
   for (const block of blocks) {
      const nameMatch = block.match(/^(.*?)<\/b>/);
      const complaint = (nameMatch ? nameMatch[1] : "").replace(/[►:]/g, "").trim();
      if (!complaint) continue;
      const details = [];
      // Detail lines look like "• Label - value.<br/>" (also tolerate "●").
      const after = block.slice(block.indexOf("</b>") + 4);
      for (const rawLine of after.split(/<br\/?>/i)) {
         const line = rawLine
            .replace(/[•●]/g, "")
            .replace(/^\s*:\s*/, "") // drop the "</b>: " separator remnant
            .replace(/\.\s*$/, "")
            .trim();
         if (!line) continue;
         const dash = line.indexOf(" - ");
         if (dash !== -1) {
            details.push({ label: line.slice(0, dash).trim(), value: line.slice(dash + 3).trim() });
         } else {
            details.push({ label: "", value: line });
         }
      }
      sections.push({ complaint, details });
   }
   return sections;
};

const parseDiagnosis = (value) => {
   const dictMatch = value.match(/\{['"]\w+['"]\s*:\s*["'](.+)["']\s*\}/s);
   if (dictMatch) {
      return { diagnosisName: dictMatch[1].replace(/\\n/g, "\n").trim(), diagnosisType: "", diagnosisStatus: "" };
   }
   const parts = value.split("::");
   if (parts.length >= 2) {
      const rest = parts[1].split(":");
      const tsParts = (rest[rest.length - 1] || "").split(" & ");
      return { diagnosisName: rest[0] || value, diagnosisType: tsParts[0] || "", diagnosisStatus: tsParts[1] || "" };
   }
   const c = value.split(":");
   return { diagnosisName: c[0] || value, diagnosisType: c[1] || "", diagnosisStatus: c[2] || "" };
};

const parseMedicine = (value) => {
   const p = value.split(":");
   return {
      drug: p[0] || "", strength: p[1] || "", days: p[2] || "",
      timing: p[3] || "", remark: p[4] || "", frequency: p[5] || "",
   };
};

const parseReferral = (value) => {
   const p = value.split(":");
   return { speciality: p[0] || "", reason: p[3] || p[1] || "" };
};

// Normalise a follow-up date to YYYY-MM-DD (matches the webapp's toDateInput).
const toDateInput = (d) => {
   if (!d) return "";
   const date = new Date(d);
   if (isNaN(date.getTime())) return "";
   return date.toISOString().slice(0, 10);
};

// "2026-08-25" -> "25 Aug 2026" for patient-facing messages.
const fmtFollowUpDate = (iso) => {
   const d = new Date(`${iso}T00:00:00Z`);
   return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};

const parseFollowUp = (obs) => {
   const members = obs.groupMembers || [];
   if (members.length > 0) {
      const get = (name) => {
         const m = members.find((mb) =>
            (mb.concept?.display || "").toLowerCase().includes(name.toLowerCase()));
         if (!m) return null;
         const v = m.value;
         return (typeof v === "object" ? v?.display : v) || m.display || null;
      };
      // A grouped follow-up obs only exists when the doctor actually scheduled
      // one, so this branch is genuinely "Yes".
      const groupedDate = get("date") || get("follow up date");
      return {
         wantFollowUp: "Yes",
         followUpDate: groupedDate,
         followUpDateIso: toDateInput(groupedDate),
         followUpTime: get("time") || get("follow up time"),
         followUpReason: get("reason") || get("remark") || get("comment"),
         followUpType: get("type") || get("visit type"),
      };
   }
   // yes/no
   const obsValue = String(obs.value || obs.display || "");
   const isYes = obsValue.includes("Time:") || obsValue.includes("Remark:");
   if (!isYes) {
      return { wantFollowUp: "No", followUpDate: null, followUpDateIso: "", followUpTime: null, followUpReason: null, followUpType: null };
   }
   const parts = obsValue.split(",").filter(Boolean);
   const extract = (key) => parts.find((v) => v.includes(key))?.split(key)?.[1]?.trim() ?? null;
   const remark = extract("Remark:");
   const type = extract("Type:");
   return {
      wantFollowUp: "Yes",
      followUpDate: parts[0]?.trim() || null,
      followUpDateIso: toDateInput(parts[0]?.trim()),
      followUpTime: extract("Time:"),
      followUpReason: remark === "null" ? null : remark,
      followUpType: type === "null" ? null : type,
   };
};
// PrescriptionData used by the PDF builder.
const buildPrescriptionData = (visit) => {
   const patient = visit?.patient;
   const person = patient?.person;
   const pn = person?.preferredName;

   const patientName = pn
      ? [pn.givenName, pn.middleName, pn.familyName].filter(Boolean).join(" ").toUpperCase()
      : person?.display || "";
   const patientId =
      patient?.identifiers?.find((id) => id.identifierType?.display === IDENTIFIER_OPENMRS_ID)?.identifier ||
      patient?.identifiers?.[0]?.identifier || "";
   const gender = person?.gender === "M" ? "Male" : person?.gender === "F" ? "Female" : person?.gender || "";
   const age = person?.age ? `${person.age} years` : "";
   const addr = person?.preferredAddress;
   const address = addr
      ? [addr.address1, addr.cityVillage, addr.countyDistrict, addr.stateProvince].filter(Boolean).join(", ")
      : null;

   const encounters = visit?.encounters || [];
   // The doctor's "Share Prescription" writes a Visit-Complete encounter;
   const shared = encounters.some(
      (enc) => enc.encounterType?.uuid === VISIT_COMPLETE_ENCOUNTER_TYPE
   );
   const consultationDate = encounters.length
      ? new Date([...encounters].sort((a, b) =>
            new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime())[0].encounterDatetime)
            .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "";

   let doctorName = "", doctorQualification = "", doctorRegNumber = "", doctorSignatureUrl = null;
   for (const enc of encounters) {
      for (const ep of enc.encounterProviders || []) {
         const prov = ep.provider;
         if (!prov) continue;
         doctorName = doctorName || prov.display || "";
         for (const attr of prov.attributes || []) {
            const d = (attr.attributeType?.display || "").toLowerCase();
            if (d === PROVIDER_ATTR.SIGNATURE || d === PROVIDER_ATTR.QUALIFICATION_CERTIFICATE)
               doctorSignatureUrl = doctorSignatureUrl || attr.value || null;
            if (d === PROVIDER_ATTR.QUALIFICATION || d === PROVIDER_ATTR.TYPE_OF_PROFESSION)
               doctorQualification = doctorQualification || attr.value || "";
            if (d === PROVIDER_ATTR.REGISTRATION_NUMBER || d === PROVIDER_ATTR.REGISTRATION_NUMBER_ALT)
               doctorRegNumber = doctorRegNumber || attr.value || "";
         }
      }
   }

   const allObs = encounters.flatMap((enc) => enc.obs || []);
   const byConceptId = (id) => allObs.filter((o) => o.concept?.uuid === id);
   const getObsValue = (id) => {
      const obs = allObs.find((o) => o.concept?.uuid === id);
      if (!obs) return null;
      const v = obs.value;
      const raw = typeof v === "object" && v !== null ? v.display || v.name : v;
      return raw ? String(raw) : null;
   };
   const followUpObs = byConceptId(CONCEPT.FOLLOW_UP);
   console.log(
      "[prescription data] follow-up obs:", visit?.uuid,
      followUpObs.length ? JSON.stringify(followUpObs.map((o) => obsStr(o))) : "(none found)"
   );
   // The visit-reason obs value is a {en,"l-en"} JSON string (doctor-portal obs
   // format); parse it and use the `en` display HTML for chief complaints.
   const visitReasonObs = allObs.find((o) => o.concept?.uuid === CONCEPT.VISIT_REASON);
   const visitReasonEn = (() => {
      const raw = visitReasonObs ? obsStr(visitReasonObs) : "";
      try {
         const parsed = JSON.parse(raw);
         return parsed?.en || raw;
      } catch {
         return raw;
      }
   })();
   const chiefComplaints = parseChiefComplaint(visitReasonEn);

   return {
      visitUuid: visit?.uuid || "",
      shared,
      patientName,
      patientUuid: patient?.uuid || "",
      patientId,
      gender,
      age,
      chiefComplaints,
      phone: getPersonAttribute(person, PERSON_ATTR.TELEPHONE),
      address,
      nationalId: getPersonAttribute(person, PERSON_ATTR.NATIONAL_ID),
      occupation: getPersonAttribute(person, PERSON_ATTR.OCCUPATION),
      consultationDate,
      location: visit?.location?.display || "",
      doctorName,
      doctorQualification,
      doctorRegNumber,
      doctorSignatureUrl,
      vitals: {
         height: getObsValue(CONCEPT.HEIGHT),
         weight: getObsValue(CONCEPT.WEIGHT),
         bpSystolic: getObsValue(CONCEPT.BP_SYSTOLIC),
         bpDiastolic: getObsValue(CONCEPT.BP_DIASTOLIC),
         pulse: getObsValue(CONCEPT.PULSE),
         temperature: getObsValue(CONCEPT.TEMPERATURE),
         spo2: getObsValue(CONCEPT.SPO2),
         respiratoryRate: getObsValue(CONCEPT.RESPIRATORY_RATE),
      },
      diagnoses: byConceptId(CONCEPT.DIAGNOSIS).map((o) => {
         const v = o.value;
         const val = typeof v === "object" && v !== null ? v.display || v.name || o.display || "" : v || o.display || "";
         return parseDiagnosis(val);
      }),
      medicines: byConceptId(CONCEPT.MEDICATION).map((o) => parseMedicine(obsStr(o))),
      advices: byConceptId(CONCEPT.ADVICE).map((o) => obsStr(o)),
      tests: byConceptId(CONCEPT.TEST).map((o) => obsStr(o)),
      referrals: byConceptId(CONCEPT.REFERRAL).map((o) => parseReferral(obsStr(o))),
      followUp: (() => {
         const parsed = followUpObs.length ? parseFollowUp(followUpObs[0]) : null;
         console.log("[prescription data] follow-up parsed:", visit?.uuid, JSON.stringify(parsed));
         return parsed;
      })(),
   };
};

// A prescription is ready to send ONLY once the doctor has explicitly shared it.
// The signal is the Visit-Complete encounter the portal writes on "Share
// Prescription" (data.shared). We intentionally do NOT treat a visit that merely
// carries a diagnosis or medicine as ready: the doctor enters those *before*
// sharing, so a fallback there leaks the PDF to the patient prematurely.
const hasPrescription = (data) => Boolean(data.shared);

module.exports = { buildPrescriptionData, hasPrescription, toDateInput, fmtFollowUpDate, CONCEPT };
