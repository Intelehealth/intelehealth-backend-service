'use strict';
const axios = require('axios');

/*
 * Model calls run 50-60s+, so this needs headroom above ai-middleware's own
 * 60s model-call timeout rather than racing it.
 */
const REQUEST_TIMEOUT_MS = 150000;

function client() {
  const baseURL = process.env.AI_MIDDLEWARE_BASE_URL;
  if (!baseURL) {
    const err = new Error('AI_MIDDLEWARE_BASE_URL is not configured');
    err.code = 'CONFIG_MISSING';
    throw err;
  }
  const apiKey = process.env.AI_MIDDLEWARE_API_KEY;
  return axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: apiKey ? { 'X-API-Key': apiKey } : {},
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

async function ddxmanual(body) {
  return forward('/ddx/manual', body);
}

async function ttxmanual(body) {
  return forward('/ttx/manual', body);
}

async function ddxfinal(body) {
  return forward('/ddxfinal', body);
}

async function ttxfinal(body) {
  return forward('/ttxfinal', body);
}

module.exports = { ddx, ttxv1, ddxmanual, ttxmanual, ddxfinal, ttxfinal };
