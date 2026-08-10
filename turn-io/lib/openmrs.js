const axios = require("axios");

const { OPENMRS_USERNAME, OPENMRS_PASSWORD, EMR_MIDDLEWARE_PUSHDATA_URL } = process.env;

const basicAuth =
   "Basic " + Buffer.from(`${OPENMRS_USERNAME}:${OPENMRS_PASSWORD}`).toString("base64");

const OPENMRS_ID = "OpenMRS ID";

const restUrl = () => (process.env.OPENMRS_REST_URL || "").replace(/\/+$/, "");

// Push persons/patients/visits/encounters to EMR-Middleware in one call.
const pushData = (bundle) =>
   axios.post(EMR_MIDDLEWARE_PUSHDATA_URL, bundle, {
      headers: { Authorization: basicAuth, "Content-Type": "application/json" },
   });

// OpenMRS generates the ID at patient creation, so read it back over REST.
const getOpenmrsId = async (personUuid) => {
   const base = restUrl();
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

// Upload an image as a complex obs so it shows under "Additional Documents" in
// the doctor portal.
const uploadComplexObs = async ({ personUuid, encounterUuid, concept, buffer, filename, mime, comment }) => {
   const base = restUrl();
   if (!base) throw new Error("OPENMRS_REST_URL is not set");

   const form = new FormData();
   form.append("file", new Blob([buffer], { type: mime }), filename);
   form.append(
      "json",
      JSON.stringify({
         concept,
         person: personUuid,
         obsDatetime: new Date().toISOString(),
         comment: comment || "",
         ...(encounterUuid && { encounter: encounterUuid }),
      })
   );

   // No explicit Content-Type: fetch sets the multipart boundary itself.
   const resp = await fetch(`${base}/obs`, {
      method: "POST",
      headers: { Authorization: basicAuth, Accept: "application/json" },
      body: form,
   });
   if (!resp.ok) {
      throw new Error(`obs upload failed ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
   }
   return resp.json();
};

module.exports = { pushData, basicAuth, getOpenmrsId, uploadComplexObs };
