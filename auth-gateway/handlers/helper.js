const axios = require("axios");

module.exports = (function () {
  const baseURL = `https://${process.env.DOMAIN}`;

  this.axiosInstance = axios.create({
    baseURL,
    timeout: 50000,
    // headers: { Authorization: "Basic c3lzbnVyc2U6SUhOdXJzZSMx" },
  });

  return this;
})();
