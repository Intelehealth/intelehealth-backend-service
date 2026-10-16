const axios = require("axios");
const { mobilabAxiosInstance, callMobilab } = require("../handlers/axiosHelper");

/**
 * POST AUTH_GATEWAY_URL/auth/login - IH login, used by the Swagger UI to get the IH JWT
 * @param {object} payload - username, password
 */
async function ihLogin(payload) {
  if (!process.env.AUTH_GATEWAY_URL) {
    const error = new Error("AUTH_GATEWAY_URL is not configured");
    error.status = 500;
    throw error;
  }
  return axios.post(`${process.env.AUTH_GATEWAY_URL}/auth/login`, payload, {
    timeout: Number(process.env.MOBILAB_TIMEOUT_MS) || 50000
  });
}

/**
 * POST /v1/auth/token - issue a new mlab_ API key.
 * Service-account credentials come from .env, never from the caller.
 * @param {object} payload - name, scopes, rate_limit_per_hour, expires_at, mode
 */
async function issueApiKey(payload) {
  return mobilabAxiosInstance.post("/v1/auth/token", {
    ...payload,
    client_id: process.env.MOBILAB_CLIENT_ID,
    client_secret: process.env.MOBILAB_CLIENT_SECRET,
    schema_name: process.env.MOBILAB_SCHEMA_NAME
  });
}

/**
 * DELETE /v1/auth/token - revoke the key used for the request
 * @param {string} apiKey - key to revoke, defaults to MOBILAB_API_KEY
 */
async function revokeApiKey(apiKey) {
  return callMobilab({ method: "DELETE", url: "/v1/auth/token" }, apiKey);
}

module.exports = {
  ihLogin,
  issueApiKey,
  revokeApiKey
};
