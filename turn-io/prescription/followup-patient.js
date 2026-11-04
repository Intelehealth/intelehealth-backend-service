// The patient a follow-up reminder was sent for, in the same shape as the patient
// lookup by mobile ({ patients: [...] }), so the Turn journey can skip registration
// and go straight to select_problem -> /visit_push with this patient_uuid.

const { getPatient, getVisit, getVisitDates, hasActiveVisit } = require("./openmrs");
const { buildPrescriptionData } = require("./data");
// Same phone formatting the reminder and survey sends use.
const { toWhatsAppNumber } = require("./turn");
const { OPENMRS_PERSON_ATTR: ATTR } = require("../constants");

const OPENMRS_ID = "OpenMRS ID";

// OpenMRS "2024-11-20T13:18:56.000+0530" -> "2024-11-20T13:18:56+05:30".
const fmtDateTime = (v) =>
   v ? String(v).replace(/\.\d{3}/, "").replace(/([+-]\d{2})(\d{2})$/, "$1:$2") : "";

// "+91XXXXXXXXXX" -- the same number the reminder was sent to, with a "+".
const fmtPhone = (v) => {
   const number = toWhatsAppNumber(v);
   return number ? `+${number}` : "";
};

// Registration stores "." as the family name when there's no surname.
const cleanName = (v) => (v && v !== "." ? v : "");

const formatPatient = (patient, { lastVisit = null, activeVisit = false } = {}) => {
   const person = patient?.person || {};
   const pn = person.preferredName || {};
   const addr = person.preferredAddress || {};
   const attr = (uuid) =>
      (person.attributes || []).find((a) => a.attributeType?.uuid === uuid)?.value || "";

   const ids = patient?.identifiers || [];
   const openmrsId = (ids.find((i) => [i.identifierType?.display, i.identifierType?.name].includes(OPENMRS_ID))
      || ids[0])?.identifier || "";

   const givenName = cleanName(pn.givenName);
   const middleName = cleanName(pn.middleName);
   const familyName = cleanName(pn.familyName);

   return {
      patient_uuid: patient?.uuid || "",
      openmrs_id: openmrsId,
      full_name: [givenName, middleName, familyName].filter(Boolean).join(" "),
      given_name: givenName,
      middle_name: middleName,
      family_name: familyName,
      gender: person.gender || "",
      age: person.age ?? null,
      birthdate: person.birthdate ? String(person.birthdate).slice(0, 10) : "",
      phone: fmtPhone(attr(ATTR.telephone)),
      address: {
         address1: addr.address1 || "",
         address2: addr.address2 || "",
         block: addr.address3 || "",
         village: addr.cityVillage || "",
         district: addr.countyDistrict || "",
         state: addr.stateProvince || "",
         postal_code: addr.postalCode || "",
         country: addr.country || "",
      },
      attributes: {
         occupation: attr(ATTR.occupation),
         son_daughter_wife_of: attr(ATTR.sonDaughterWifeOf),
         caste: attr(ATTR.caste),
         education: attr(ATTR.education),
         economic_status: attr(ATTR.economicStatus),
         emergency_contact_name: attr(ATTR.emergContactName),
         emergency_contact_number: attr(ATTR.emergContactNum),
         emergency_contact_type: attr(ATTR.emergContactType),
         // Consent is "date | patient uuid | language | status | source".
         language: (attr(ATTR.consent).split("|")[2] || "").trim(),
      },
      last_visit: lastVisit,
      has_active_visit: activeVisit,
   };
};

// The visit the reminder was about, as last_visit. null if it can't be read.
const describeVisit = async (visitUuid) => {
   if (!visitUuid) return null;
   const [dates, visit] = await Promise.all([getVisitDates(visitUuid), getVisit(visitUuid)]);
   const data = buildPrescriptionData(visit);
   return {
      visit_uuid: visitUuid,
      visit_date: fmtDateTime(dates?.startDatetime),
      chief_complaint: (data.chiefComplaints || []).map((c) => c.complaint).join(", "),
      status: dates?.stopDatetime ? "closed" : "open",
      has_prescription: Boolean(data.shared),
   };
};

// Full patient entry for /followup/start. The patient read must succeed; the visit
// and active-visit reads are extras and fall back to null / false on failure.
const getFollowUpPatient = async (patientUuid, visitUuid) => {
   const [patient, lastVisit, activeVisit] = await Promise.all([
      getPatient(patientUuid),
      describeVisit(visitUuid).catch((err) => {
         console.warn(`[followup start] last visit ${visitUuid} lookup failed:`, err.response?.data || err.message);
         return null;
      }),
      hasActiveVisit(patientUuid).catch(() => false),
   ]);
   return formatPatient(patient, { lastVisit, activeVisit });
};

module.exports = { getFollowUpPatient, formatPatient };
