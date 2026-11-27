const DEFAULT_TIMEOUT_MS = 60000;

const envValue = (name) => {
  const raw = process.env[name];
  if (!raw) {
    return '';
  }
  return raw.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
};

const configMissing = (name) => {
  const err = new Error(`${name} is not configured`);
  err.code = 'CONFIG_MISSING';
  err.configKey = name;
  return err;
};

const parseBody = (text) => {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

const ddx = async (body, { timeout } = {}) => {
  const baseURL = envValue('AI_MIDDLEWARE_BASE_URL');
  if (!baseURL) {
    throw configMissing('AI_MIDDLEWARE_BASE_URL');
  }
  const apiKey = envValue('AI_MIDDLEWARE_API_KEY');
  if (!apiKey) {
    throw configMissing('AI_MIDDLEWARE_API_KEY');
  }

  const controller = new AbortController();
  const timeoutMs = timeout || DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseURL}/ddx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(`AI middleware responded ${response.status}${text ? `: ${text}` : ''}`);
      err.status = response.status;
      err.responseBody = { status: response.status, body: parseBody(text) };
      throw err;
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`AI middleware request timed out after ${timeoutMs}ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

module.exports = { ddx };
