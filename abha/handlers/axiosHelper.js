const axios = require("axios");
const { logStream } = require("../logger");
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

  this.axiosInstance.interceptors.request.use(
    (config) => {
      logStream("debug", config.headers, "ABDM Request Header");
      return config;  // Ensure the request continues
    },
    (error) => {
      return Promise.reject(error);  // In case of request error
    }
  );

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
