const axios = require("axios");

module.exports = (function () {
  
  this.axiosInstance = axios.create({
    timeout: 50000,
  });

  return this;
})();
