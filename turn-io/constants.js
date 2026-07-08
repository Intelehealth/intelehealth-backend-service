// Fixed OpenMRS UUIDs used to build patient/visit/encounter/obs bundles.
// These identify OpenMRS metadata (concepts, encounter types, visit/person
// attribute types) and are the same across environments, so they live in code
// rather than .env (which holds only secrets + per-environment URLs).
// Mirrors the doctor webapp's openmrs_uuids / HW constants.

module.exports = {
   // Patient identifier + location
   OPENMRS_IDENTIFIER_TYPE_UUID: "05a29f94-c0ed-11e2-94be-8c13b969e334",
   OPENMRS_LOCATION_UUID: "9172f0c5-2a6d-43ba-84f8-37276a2db14b",

   // Visit + encounter types
   OPENMRS_VISIT_TYPE_UUID: "a86ac96e-2e07-47a7-8e72-8216a1a75bfd",
   OPENMRS_ENCOUNTER_TYPE_ADULT_INITIAL: "8d5b27bc-c2cc-11de-8d13-0010c6dffd0f",
   OPENMRS_ENCOUNTER_TYPE_VITALS: "67a71486-1a54-468f-ac3e-7091a9a79584",
   OPENMRS_ENCOUNTER_ROLE_UUID: "73bbb069-9781-4afc-a9d1-54b6b2270e04",

   // Provider (doctor1)
   OPENMRS_PROVIDER_UUID: "e306438c-4c1c-4a8f-97a8-c9ff2c0004c9",

   // ADULT_INITIAL concept UUIDs
   OPENMRS_CONCEPT_VISIT_REASON: "3edb0e09-9135-481e-b8f0-07a26fa9a5ce",
   OPENMRS_CONCEPT_PHYSICAL_EXAM: "e1761e85-9b50-48ae-8c4d-e6b7eeeba084",
   OPENMRS_CONCEPT_MEDICAL_HISTORY: "62bff84b-795a-45ad-aae1-80e7f5163a82",
   OPENMRS_CONCEPT_FAMILY_HISTORY: "d63ae965-47fb-40e8-8f08-1f46a8a60b2b",

   // Vitals concept UUIDs (standard OpenMRS concepts)
   OPENMRS_CONCEPT_HEIGHT: "5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
   OPENMRS_CONCEPT_WEIGHT: "5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",

   // Visit attribute type UUIDs
   OPENMRS_VISIT_ATTR_SPECIALITY: "3f296939-c6d3-4d2e-b8ca-d7f4bfd42c2d",
   OPENMRS_VISIT_ATTR_COMPLETE_DATETIME: "e76eee5e-9d73-4d07-8f30-16b77e626ccf",
   OPENMRS_VISIT_ATTR_DOCTOR_NOTES: "64aa50c8-e913-48c6-b8ad-dfa0bccb202b",
};
