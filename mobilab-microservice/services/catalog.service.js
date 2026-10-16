const { callMobilab } = require("../handlers/axiosHelper");

/**
 * GET /v1/lab-tests
 * @param {object} params - limit, offset
 */
async function getLabTests(params) {
  return callMobilab({ method: "GET", url: "/v1/lab-tests", params });
}

/**
 * GET /v1/lab-profiles
 * @param {object} params - limit, offset
 */
async function getLabProfiles(params) {
  return callMobilab({ method: "GET", url: "/v1/lab-profiles", params });
}

module.exports = {
  getLabTests,
  getLabProfiles
};
