const axios = require("axios");

module.exports = (function () {
  const baseURL = `https://${process.env.DOMAIN}`;
  console.log("baseURL: ", baseURL);

  this.axiosInstance = axios.create({
    baseURL,
    timeout: 50000,
    // headers: { Authorization: "Basic c3lzbnVyc2U6SUhOdXJzZSMx" },
  });

  return this;
})();
