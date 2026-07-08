const axios = require("axios");

const { OPENMRS_USERNAME, OPENMRS_PASSWORD, EMR_MIDDLEWARE_PUSHDATA_URL } = process.env;

const basicAuth =
   "Basic " + Buffer.from(`${OPENMRS_USERNAME}:${OPENMRS_PASSWORD}`).toString("base64");

// Push a bundled payload to the EMR-Middleware /push/pushdata endpoint, which
// accepts patients/persons/visits/encounters in one call and performs the
// OpenMRS writes so the doctor portal sees the data.
const pushData = (bundle) =>
   axios.post(EMR_MIDDLEWARE_PUSHDATA_URL, bundle, {
      headers: { Authorization: basicAuth, "Content-Type": "application/json" },
   });

module.exports = { pushData, basicAuth };
