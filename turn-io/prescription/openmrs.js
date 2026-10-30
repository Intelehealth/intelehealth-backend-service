const axios = require("axios");
const { basicAuth } = require("../lib/openmrs");

// Base OpenMRS REST URL, e.g. https://dev.intelehealth.org/openmrs/ws/rest/v1
const restBase = () => (process.env.OPENMRS_REST_URL || "").replace(/\/+$/, "");

const openmrsGet = (path, params) =>
   axios.get(`${restBase()}${path}`, { params, headers: { Authorization: basicAuth, Accept: "application/json" } });

// Custom rep mirrors the HW webapp (visit-prescription.service.ts) for the prescription's obs/provider/patient fields.
// startDatetime/stopDatetime dropped: buildPrescriptionData derives consultationDate from encounters instead.
const VISIT_CUSTOM_REP =
   "custom:(uuid,location:(display),attributes:(value,attributeType:(uuid,display))," +
   "patient:(uuid,identifiers:(identifier,identifierType:(name,display))," +
   "person:(display,gender,age,birthdate,preferredName:(givenName,middleName,familyName)," +
   "attributes:(value,attributeType:(display,uuid)),preferredAddress:(address1,address2,cityVillage,countyDistrict,stateProvince,postalCode)))," +
   "encounters:(encounterDatetime,encounterType:(uuid,display)," +
   "obs:(uuid,display,value,concept:(uuid,display),groupMembers:(uuid,display,value,concept:(uuid,display)))," +
   "encounterProviders:(provider:(uuid,display,attributes:(value,attributeType:(display))))))";

// Fetch a single visit with the full custom representation used for the PDF.
const getVisit = async (visitUuid) => {
   try {
      const { data } = await openmrsGet(`/visit/${visitUuid}`, { v: VISIT_CUSTOM_REP });
      return data;
   } catch (err) {
      // OpenMRS "uuid doesn't exist [null]" can mean a nested field in the custom
      // rep (not the visit itself) is null -- log the requested uuid alongside the
      // full error so a bad-visit-uuid case is distinguishable from a data issue.
      console.error(`[openmrs] getVisit(${visitUuid}) failed:`, err.response?.data || err.message);
      throw err;
   }
};

// Just the visit attributes -- for a caller-supplied visit that came without them.
const getVisitAttributes = async (visitUuid) => {
   const { data } = await openmrsGet(`/visit/${visitUuid}`, { v: "custom:(attributes:(value,attributeType:(uuid,display)))" });
   return data?.attributes || [];
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

const VISITS_PAGE_SIZE = 25; // mindmap's default page size (we never pass `limit`)

// One speciality's full list from a mindmap visit endpoint (getFollowUpVisits,
// getCompletedVisits, ...); none of them has an "all specialities" option.
// Pages come newest-first, so `stopAfterPage(results)` can end the scan early.
const getMindmapVisitsForSpeciality = async (endpoint, speciality, token, stopAfterPage) => {
   const all = [];
   for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await axios.get(`${mindmapBase()}/openmrs/${endpoint}`, {
         params: { speciality, page },
         headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const results = data?.data || [];
      all.push(...results);
      if (results.length < VISITS_PAGE_SIZE) break; // short page = last page
      if (stopAfterPage?.(results)) break;
   }
   return all;
};

// Every visit from `endpoint` across all enabled specialities, de-duplicated by uuid.
const getMindmapVisits = async (endpoint, { tag = "[mindmap]", stopAfterPage } = {}) => {
   if (!mindmapBase()) {
      console.warn(`${tag} MIND_MAP_URL is not set -- skipping mindmap lookup`);
      return [];
   }

   const token = await getMindmapToken();
   const specialities = await getEnabledSpecialities(token);
   const byUuid = new Map();
   for (const speciality of specialities) {
      for (const v of await getMindmapVisitsForSpeciality(endpoint, speciality, token, stopAfterPage)) {
         if (v?.uuid && !byUuid.has(v.uuid)) byUuid.set(v.uuid, v);
      }
   }

   const all = [...byUuid.values()];
   console.log(`${tag} fetched ${all.length} visits from ${endpoint} across ${specialities.length} specialities`);
   return all;
};

// All follow-up visits across every enabled speciality; each item's `uuid` feeds straight into getVisit.
const getFollowUpVisits = () => getMindmapVisits("getFollowUpVisits", { tag: "[followup mindmap]" });

// Post-consultation survey (IDTP-177): the survey cron picks its patients from this list.
// Completed (prescription shared) visits. Items carry encounters[].{encounter_datetime, type.name}.
const getCompletedVisits = (opts = {}) =>
   getMindmapVisits("getCompletedVisits", { tag: "[survey mindmap]", ...opts });

module.exports = { getVisit, getVisitAttributes, getFollowUpVisits, getCompletedVisits };
