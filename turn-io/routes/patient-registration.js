const express = require("express");
const { randomUUID } = require("crypto");
const { pushData } = require("../lib/openmrs");

const {
   OPENMRS_IDENTIFIER_TYPE_UUID,
   OPENMRS_LOCATION_UUID,
} = require("../constants");   

// OpenMRS person_attribute_type UUIDs (from HW webapp openmrs_uuids.ts).
const ATTR = {
   telephone:         "14d4f066-15f5-102d-96e4-000c29c2a5d7",
   occupation:        "ecdaadb6-14a0-4ed9-b5b7-cfed87b44b87",
   sonDaughterWifeOf: "1b2f34f7-2bf8-4ef7-9736-f5b858afc160",
   caste:             "5a889d96-0c84-4a04-88dc-59a6e37db2d3",
   education:         "1c718819-345c-4368-aad6-d69b4c267db7",
   economicStatus:    "f4af0ef3-579c-448a-8157-750283409122",
   emergContactName:  "9b37e244-2cf5-4bd8-af32-b85ed4f919aa",
   emergContactNum:   "6c25becf-1bdd-4b2e-98dd-558a4becf4a4",
   emergContactType:  "5fde1411-801c-49b9-93d4-abeefd8e1164",
   consent:           "11b990b9-2798-477a-9aad-073e5459f5d3",
};

// DD-MM-YYYY HH:mm:ss, no extra date library needed for this one field.
const formatConsentDate = (d) => {
   const pad = (n) => String(n).padStart(2, "0");
   return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Reaching registration means the patient accepted consent on WhatsApp, so status is always "active".
const buildConsentValue = ({ patientUuid, language }) =>
   [formatConsentDate(new Date()), patientUuid || "", language || "", "active", "Turn-whatsapp"].join(" | ");

const genderMap = { male: "M", female: "F", other: "O" };
const journeyMap = { "abdominal pain": "abd_pain", "fever": "fever", "diabetes": "diabetes" };

// Treat blanks, unresolved "@results.x" placeholders, and junk words as missing.
const JUNK = new Set(["null", "undefined", "na", "n/a", "none", "-"]);
const isJunk = (v) =>
   !v || typeof v !== "string" || v.trim() === "" ||
   v.trim().startsWith("@") || JUNK.has(v.trim().toLowerCase());

const pick = (...values) => values.find((v) => !isJunk(v)) || "";

const router = express.Router();

router.post("/patient_registration", async (req, res) => {
   try {
      // Turn posts flat fields; fall back to contact.*/results.* for the older journey shape.
      const b = req.body || {};
      const c = b.contact || {};
      const r = b.results || {};
      const personUuid = randomUUID();

      const name = pick(b.full_name, r.preferred_name, c.preferred_name, c.name) || "Unknown";
      const middle = pick(b.middle_name, r.middle_name, c.middle_name);
      const surname = pick(b.surname, r.surname, c.surname);
      const gender = pick(b.gender, b.sex, r.gender, c.gender);
      // Prefer whatsapp_id: it's the number the patient is chatting from, always
      // in deliverable wa_id form (country code + digits), 
      const mobile = pick(b.whatsapp_id, c.whatsapp_id, r.mobile_number, c.mobile);

      const address1       = pick(r.address1, c.address1);
      const address2       = pick(r.address2, c.address2);
      // "Block"maps onto OpenMRS's
      // address3
      const block          = pick(b.block, r.block, c.block, b.block_address, r.block_address, c.block_address);
      const cityVillage    = pick(b.village_street, r.city_village, c.city_village, r.village_address, c.village_address, r.village, c.village, r.village_district, c.village_district);
      const countyDistrict = pick(b.district_town, r.county_district, c.county_district, r.district_town, c.district_town, r.district, c.district);
      const stateProvince  = pick(r.state_province, c.state_province, r.state, c.state);
      const postalCode     = pick(r.postal_code, c.postal_code, r.pincode, c.pincode);
      const country        = pick(r.country, c.country) || "India";

      const language = pick(b.language, r.language, c.language) || "hi";

      const attrValues = {
         [ATTR.telephone]:         mobile,
         [ATTR.occupation]:        pick(b.occupation, r.occupation, c.occupation),
         [ATTR.sonDaughterWifeOf]: pick(b.relationship, r.son_daughter_wife_of, c.son_daughter_wife_of, r.relationship, c.relationship),
         [ATTR.caste]:             pick(r.caste, c.caste),
         [ATTR.education]:         pick(r.education, c.education),
         [ATTR.economicStatus]:    pick(r.economic_status, c.economic_status),
         [ATTR.emergContactName]:  pick(r.contact_name, c.contact_name, r.emergency_contact_name, c.emergency_contact_name),
         [ATTR.emergContactNum]:   pick(r.secondary_phone, c.secondary_phone, r.emergency_contact_number, c.emergency_contact_number),
         [ATTR.emergContactType]:  pick(r.contact_type, c.contact_type, r.emergency_contact_type, c.emergency_contact_type),
         [ATTR.consent]:           buildConsentValue({ patientUuid: personUuid, language }),
      };
      const attributes = Object.entries(attrValues)
         .filter(([, value]) => !isJunk(value))
         .map(([attributeType, value]) => ({ value, attributeType }));

      let age = parseInt(pick(b.age, r.age, c.age), 10);
      const birthdayRaw = pick(b.dob, r.date_of_birth, c.date_of_birth, r.birthday, c.birthday);
      if (!(age > 0) && birthdayRaw) {
         // Tolerate Turn's Elixir date format like "~U[2016-05-14 11:24:22Z]".
         const cleaned = String(birthdayRaw).replace(/^~U\[/, "").replace(/\]$/, "").replace(" ", "T");
         const bday = new Date(cleaned);
         if (!isNaN(bday.getTime())) age = new Date().getFullYear() - bday.getFullYear();
      }
      const safeAge = age > 0 && age < 120 ? age : 30;

      // Prefer surname, else the rest of the name, else "." (OpenMRS renders an
      // empty family name as the literal "null").
      const [givenName, ...rest] = name.trim().split(/\s+/);
      const restJoined = rest.join(" ");
      const familyName = !isJunk(surname) ? surname : (!isJunk(restJoined) ? restJoined : ".");

      const bundle = {
         appointments: [],
         encounters: [],
         providers: [],
         visits: [],
         persons: [{
            uuid: personUuid,
            gender: genderMap[gender.toLowerCase()] || "O",
            birthdate: `${new Date().getFullYear() - safeAge}-01-01`,
            names: [{ givenName, middleName: middle || "", familyName }],
            addresses: [{
               address1, address2, address3: block, address6: "",
               cityVillage, country, countyDistrict, postalCode, stateProvince,
            }],
            attributes,
         }],
         patients: [{
            person: personUuid,
            identifiers: [{
               identifierType: OPENMRS_IDENTIFIER_TYPE_UUID,
               location: OPENMRS_LOCATION_UUID,
               preferred: true,
            }],
         }],
      };

      await pushData(bundle);

      const symptom = (b.symptom || r.symptom || "").toLowerCase();
      const next_journey = journeyMap[symptom] || "abd_pain";

      res.json({ success: true, patient_uuid: personUuid, next_journey });
   } catch (err) {
      const detail = err.response?.data || err.message;
      console.error("[patient_registration] error:", detail);
      res.status(500).json({ success: false, error: detail });
   }
});

module.exports = router;
