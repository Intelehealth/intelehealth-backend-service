const axios = require("axios");
const { basicAuth } = require("../lib/openmrs");

// Base OpenMRS REST URL, e.g. https://dev.intelehealth.org/openmrs/ws/rest/v1
const restBase = () => (process.env.OPENMRS_REST_URL || "").replace(/\/+$/, "");

const openmrsGet = (path, params) =>
   axios.get(`${restBase()}${path}`, { params, headers: { Authorization: basicAuth, Accept: "application/json" } });

// Custom rep mirrors the HW webapp (visit-prescription.service.ts) for the prescription's obs/provider/patient fields.
const VISIT_CUSTOM_REP =
   "custom:(uuid,startDatetime,stopDatetime,location:(display)," +
   "patient:(uuid,identifiers:(identifier,identifierType:(name,display))," +
   "person:(display,gender,age,birthdate,preferredName:(givenName,middleName,familyName)," +
   "attributes:(value,attributeType:(display,uuid)),preferredAddress:(address1,address2,cityVillage,countyDistrict,stateProvince,postalCode)))," +
   "encounters:(encounterDatetime,encounterType:(uuid,display)," +
   "obs:(uuid,display,value,concept:(uuid,display),groupMembers:(uuid,display,value,concept:(uuid,display)))," +
   "encounterProviders:(provider:(uuid,display,attributes:(value,attributeType:(display))))))";

// Fetch a single visit with the full custom representation used for the PDF.
const getVisit = async (visitUuid) => {
   const { data } = await openmrsGet(`/visit/${visitUuid}`, { v: VISIT_CUSTOM_REP });
   return data;
};

// Follow-up obs search: just the value and which visit it belongs to.
const FOLLOWUP_OBS_CUSTOM_REP = "custom:(uuid,value,encounter:(uuid,visit:(uuid)))";
const OBS_PAGE_SIZE = Number(process.env.OPENMRS_OBS_PAGE_SIZE || 100);
const OBS_MAX_PAGES = Number(process.env.OPENMRS_OBS_MAX_PAGES || 500);

// All obs recorded against a concept, across every patient/visit, paged until the server stops returning new rows.
const getFollowUpObs = async (conceptUuid) => {
   const all = [];
   const seen = new Set(); // guards a server that ignores startIndex and repeats a page
   let startIndex = 0;

   for (let page = 0; page < OBS_MAX_PAGES; page++) {
      const { data } = await openmrsGet("/obs", { concept: conceptUuid, v: FOLLOWUP_OBS_CUSTOM_REP, limit: OBS_PAGE_SIZE, startIndex });
      const results = data?.results || [];
      if (!results.length) break;

      const before = all.length;
      for (const obs of results) {
         const key = obs?.uuid || JSON.stringify(obs);
         if (seen.has(key)) continue;
         seen.add(key);
         all.push(obs);
      }

      if (results.length < OBS_PAGE_SIZE || all.length === before) break; // last page, or server repeating itself
      startIndex += results.length;
   }

   console.log(`[followup obs] fetched ${all.length} follow-up obs in pages of ${OBS_PAGE_SIZE}`);
   return all;
};

module.exports = { getVisit, getFollowUpObs };
