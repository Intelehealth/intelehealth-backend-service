'use strict';
const axios = require('axios');

/*
 * Model calls run 50-60s+, so this needs headroom above ai-middleware's own
 * 60s model-call timeout rather than racing it.
 */
const REQUEST_TIMEOUT_MS = 150000;
function envValue(name) {
  const raw = process.env[name];
  if (!raw) {
    return '';
  }
  return raw.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
}

function configMissing(name) {
  const err = new Error(`${name} is not configured`);
  err.code = 'CONFIG_MISSING';
  err.configKey = name;
  return err;
}

function client() {
  const baseURL = envValue('AI_MIDDLEWARE_BASE_URL');
  if (!baseURL) {
    throw configMissing('AI_MIDDLEWARE_BASE_URL');
  }
  const apiKey = envValue('AI_MIDDLEWARE_API_KEY');
  if (!apiKey) {
    throw configMissing('AI_MIDDLEWARE_API_KEY');
  }
  return axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'X-API-Key': apiKey },
  });
}


/*
 * Forwards the body and returns the response unchanged, so existing frontend
 * parsing keeps working.
 */
async function forward(path, body) {
  const response = await client().post(path, body);
  return response.data;
}

async function ddx(body) {
  return forward('/ddx', body);
}

async function ttxv1(body) {
  return forward('/ttxv1', body);
}

module.exports = { ddx, ttxv1 };
