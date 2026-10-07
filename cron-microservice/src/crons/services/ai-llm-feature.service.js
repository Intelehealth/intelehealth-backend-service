const CACHE_TTL_MS = 30000;

let cachedFlags = null;
let cacheExpiresAt = 0;

const configServiceUrl = () => (process.env.AI_LLM_CONFIG_SERVICE_URL || '').trim().replace(/\/$/, '');

const fetchPublishedAiLlmFlags = async () => {
  const baseURL = configServiceUrl();
  if (!baseURL) {
    return null;
  }

  const response = await fetch(`${baseURL}/config/getPublishedConfig`);
  if (!response.ok) {
    throw new Error(`config service responded ${response.status}`);
  }
  const published = await response.json();
  return published?.ai_llm || {};
};

const getPublishedAiLlmFlags = async () => {
  const now = Date.now();
  if (cachedFlags && now < cacheExpiresAt) {
    return cachedFlags;
  }

  try {
    const flags = await fetchPublishedAiLlmFlags();
    if (flags) {
      cachedFlags = flags;
      cacheExpiresAt = now + CACHE_TTL_MS;
    }
    return cachedFlags || {};
  } catch (error) {
    return cachedFlags || {};
  }
};

const isFeatureEnabled = async (key) => {
  const flags = await getPublishedAiLlmFlags();
  if (flags[key] === undefined) {
    return true;
  }
  return Boolean(flags[key]);
};

module.exports = { isFeatureEnabled, getPublishedAiLlmFlags };
