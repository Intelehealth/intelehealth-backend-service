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

// Fetching Follow-ups from mindmap service
// (GET /obs?concept=... returns nothing on this server, for any concept).
const AUTH_GATEWAY_URL = (process.env.AUTH_GATEWAY_URL || "").replace(/\/+$/, "");
const mindmapBase = () => (process.env.MIND_MAP_URL || "").replace(/\/+$/, "");
const configBase = () => (process.env.CONFIG_URL || "").replace(/\/+$/, "");
const MAX_PAGES = Number(process.env.FOLLOWUP_MAX_PAGES || 500);
const CACHE_TTL_MS = 30 * 60 * 1000;

// A doctor JWT for the mindmap/config services, minted from turn-io's own OpenMRS login, cached until due to expire.
let cachedToken = null;
let tokenExpiresAt = 0;

const getMindmapToken = async () => {
   if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

   const { data } = await axios.post(`${AUTH_GATEWAY_URL}/auth/login`, {
      username: process.env.OPENMRS_USERNAME,
      password: process.env.OPENMRS_PASSWORD,
   });
   if (!data?.token) throw new Error("auth-gateway login did not return a token");

   cachedToken = data.token;
   tokenExpiresAt = Date.now() + CACHE_TTL_MS;
   return cachedToken;
};

// Enabled speciality names, from the same "Refer Specialisation" dropdown the doctor webapp's referral form uses.
let cachedSpecialities = null;
let specialitiesExpireAt = 0;

const getEnabledSpecialities = async (token) => {
   if (cachedSpecialities && Date.now() < specialitiesExpireAt) return cachedSpecialities;
   if (!configBase()) {
      console.warn("[followup mindmap] CONFIG_URL is not set -- no specialities to query");
      return [];
   }

   const { data } = await axios.get(`${configBase()}/dropdown/all`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
   });
   const referSpecialisation = data?.dropdown?.["refer specialisation"] || [];
   cachedSpecialities = referSpecialisation.filter((s) => s.is_enabled).map((s) => s.name);
   specialitiesExpireAt = Date.now() + CACHE_TTL_MS;
   return cachedSpecialities;
};

const FOLLOWUP_VISITS_PAGE_SIZE = 25; // fixed by the mindmap service, not configurable

// One speciality's full follow-up list; getFollowUpVisits has no "all specialities" option.
const getFollowUpVisitsForSpeciality = async (speciality, token) => {
   const all = [];
   for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await axios.get(`${mindmapBase()}/openmrs/getFollowUpVisits`, {
         params: { speciality, page },
         headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const results = data?.data || [];
      all.push(...results);
      if (results.length < FOLLOWUP_VISITS_PAGE_SIZE) break; // short page = last page
   }
   return all;
};

// All follow-up visits across every enabled speciality; each item's `uuid` feeds straight into getVisit.
const getFollowUpVisits = async () => {
   if (!mindmapBase()) {
      console.warn("[followup mindmap] MIND_MAP_URL is not set -- skipping mindmap lookup");
      return [];
   }

   const token = await getMindmapToken();
   const specialities = await getEnabledSpecialities(token);
   const all = [];
   for (const speciality of specialities) {
      all.push(...(await getFollowUpVisitsForSpeciality(speciality, token)));
   }

   console.log(`[followup mindmap] fetched ${all.length} follow-up visits across ${specialities.length} specialities`);
   return all;
};

module.exports = { getVisit, getFollowUpVisits };
