const axios = require("axios");
const { logStream } = require("../logger");

const {
  MOBILAB_BASE_URL,
  MOBILAB_TIMEOUT_MS,
} = process.env;

if (!MOBILAB_BASE_URL) {
  throw new Error("MOBILAB_BASE_URL is not set in .env");
}

/**
 * Axios instance to call the Mobilab External API
 */
const mobilabAxiosInstance = axios.create({
  baseURL: MOBILAB_BASE_URL,
  timeout: Number(MOBILAB_TIMEOUT_MS) || 50000,
  headers: { Accept: "application/json" },
});

// Log method, path and status only - bodies carry patient data and API keys
const describe = (config) => `${config?.method?.toUpperCase()} ${config?.url}`;

mobilabAxiosInstance.interceptors.request.use(
  (config) => {
    logStream("debug", describe(config), "Mobilab Request");
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

mobilabAxiosInstance.interceptors.response.use(
  (response) => {
    logStream("debug", `${describe(response.config)} ${response.status}`, "Mobilab Response");
    return response;
  },
  (error) => {
    const status = error?.response?.status ?? error?.code;
    const errorCode = error?.response?.data?.error?.code ?? "";
    logStream("error", `Mobilab Error---${describe(error?.config)} ${status} ${errorCode}`.trim());
    return Promise.reject(error);
  }
);

/**
 * Mobilab Authorization header
 * @param {string} apiKey - defaults to MOBILAB_API_KEY
 */
function getHeaders(apiKey = process.env.MOBILAB_API_KEY) {
  if (!apiKey) {
    const error = new Error("MOBILAB_API_KEY is not configured");
    error.status = 500;
    throw error;
  }
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Call Mobilab with the API key
 * @param {import("axios").AxiosRequestConfig} config
 * @param {string} apiKey - optional override of MOBILAB_API_KEY
 */
async function callMobilab(config, apiKey) {
  return mobilabAxiosInstance.request({
    ...config,
    headers: { ...getHeaders(apiKey), ...config.headers }
  });
}

module.exports = { mobilabAxiosInstance, callMobilab };
