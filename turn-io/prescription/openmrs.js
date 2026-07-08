const axios = require("axios");
const { basicAuth } = require("../lib/openmrs");

// Base OpenMRS REST URL, e.g. https://dev.intelehealth.org/openmrs/ws/rest/v1
const restBase = () => (process.env.OPENMRS_REST_URL || "").replace(/\/+$/, "");

const openmrsGet = (path, params) =>
   axios.get(`${restBase()}${path}`, {
      params,
      headers: { Authorization: basicAuth, Accept: "application/json" },
   });

// Custom representation mirrors the HW webapp (visit-prescription.service.ts) so
// the same obs/provider/patient fields are available to build the prescription.
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

module.exports = { getVisit };
