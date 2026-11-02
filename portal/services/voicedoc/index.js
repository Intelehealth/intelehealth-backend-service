'use strict';
const { loadConfig, DEFAULT_FIELDS } = require('./config');
const { VoiceDocClient, VoiceDocError } = require('./client');
const { MockVoiceDocClient } = require('./mock');

let client = null;
let lane = Promise.resolve();

function configMissing(name) {
  const err = new Error(`${name} is not configured`);
  err.code = 'CONFIG_MISSING';
  err.configKey = name;
  return err;
}

function getConfig() {
  return loadConfig();
}

function getClient() {
  if (client) {
    return client;
  }
  const cfg = loadConfig();
  if (cfg.mock) {
    client = new MockVoiceDocClient(cfg);
    return client;
  }
  if (!cfg.email) {
    throw configMissing('VOICEDOC_EMAIL');
  }
  if (!cfg.password) {
    throw configMissing('VOICEDOC_PASSWORD');
  }
  client = new VoiceDocClient(cfg);
  return client;
}

function setClient(c) {
  client = c;
}

function runInLane(fn) {
  const result = lane.then(() => fn());
  lane = result.then(() => undefined, () => undefined);
  return result;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, attempts = 5, baseDelayMs = 1000) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = !err.status || err.status === 429 || err.status >= 500;
      if (!retryable || i >= attempts) throw err;
      await sleep(baseDelayMs * 2 ** (i - 1) + Math.random() * (baseDelayMs / 2));
    }
  }
}

function buildRecordingName(patientId, visitId, timeZone, now = new Date()) {
  const clean = (v) => String(v || '').trim().replace(/\s+/g, '-');
  const identifier = [clean(patientId) || 'UNKNOWN', clean(visitId)].filter(Boolean).join('_');
  const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
  let stamp;
  try {
    stamp = now.toLocaleString('en-US', { ...options, timeZone: timeZone || loadConfig().timeZone });
  } catch {
    stamp = now.toLocaleString('en-US', options);
  }
  return `MR-${identifier} ${stamp.replace(/,/g, '').replace(/\s+/g, ' ')}`;
}

function parseSummary(summary) {
  if (typeof summary !== 'string') return summary ?? null;
  try {
    return JSON.parse(summary);
  } catch {
    return { 'Raw Response': summary };
  }
}

module.exports = {
  DEFAULT_FIELDS,
  VoiceDocClient,
  VoiceDocError,
  MockVoiceDocClient,
  getConfig,
  getClient,
  setClient,
  runInLane,
  withRetry,
  buildRecordingName,
  parseSummary,
  configMissing,
};
