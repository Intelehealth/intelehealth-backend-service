const axios = require("axios");

module.exports = (function () {
  const { DOMAIN, OPENMRS_USERNAME, OPENMRS_PASS } = process.env;

  const baseURL = `https://${DOMAIN}`;

  this.axiosInstance = axios.create({
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
