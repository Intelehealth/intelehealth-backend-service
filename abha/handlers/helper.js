const axios = require("axios");
const {
  DOMAIN,
  OPENMRS_USERNAME,
  OPENMRS_PASS,
} = process.env;

/**
 * BaseUrl for domain
 */
const baseURL = `https://${DOMAIN}/openmrs`;

module.exports = (function () {

  this.axiosInstance = axios.create({
    timeout: 50000,
  });

  /**
   * Axios instance to ftech openmrs api
   */
  this.openmrsAxiosInstance = axios.create({
    baseURL,
    timeout: 50000,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${OPENMRS_USERNAME}:${OPENMRS_PASS}`
      ).toString("base64")}`,
    },
  });

  return this;
})();
