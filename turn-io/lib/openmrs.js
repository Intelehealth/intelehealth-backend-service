const axios = require("axios");

const { OPENMRS_USERNAME, OPENMRS_PASSWORD, EMR_MIDDLEWARE_PUSHDATA_URL } = process.env;

const basicAuth =
   "Basic " + Buffer.from(`${OPENMRS_USERNAME}:${OPENMRS_PASSWORD}`).toString("base64");

const OPENMRS_ID = "OpenMRS ID";

// Push persons/patients/visits/encounters to EMR-Middleware in one call.
const pushData = (bundle) =>
   axios.post(EMR_MIDDLEWARE_PUSHDATA_URL, bundle, {
      headers: { Authorization: basicAuth, "Content-Type": "application/json" },
   });

// OpenMRS generates the ID at patient creation, so read it back over REST.
const getOpenmrsId = async (personUuid) => {
   const base = (process.env.OPENMRS_REST_URL || "").replace(/\/+$/, "");
   if (!base || !personUuid) return "";

   const { data } = await axios.get(`${base}/patient/${personUuid}`, {
      params: { v: "custom:(identifiers:(identifier,identifierType:(name,display)))" },
      headers: { Authorization: basicAuth, Accept: "application/json" },
   });

   const ids = data?.identifiers || [];
   const match = ids.find(
      ({ identifierType: t }) => t?.display === OPENMRS_ID || t?.name === OPENMRS_ID
   );
   return match?.identifier || ids[0]?.identifier || "";
};

module.exports = { pushData, basicAuth, getOpenmrsId };
