'use strict';
const { loadConfig, DEFAULT_FIELDS } = require('./config');
const { VoiceDocClient, VoiceDocError } = require('./client');
const { MockVoiceDocClient } = require('./mock');

const DEFAULT_ACCOUNT = 'default';
const DOCTOR_EMAIL_DOMAIN = 'intelehealth.org';

let clientOverride = null;
let clientFactory = null;
const clients = new Map();
const lanes = new Map();
const failedLogins = new Map();

function configMissing(name) {
  const err = new Error(`${name} is not configured`);
  err.code = 'CONFIG_MISSING';
  err.configKey = name;
  return err;
}

function getConfig() {
  return loadConfig();
}

function accountKey(account) {
  return account || DEFAULT_ACCOUNT;
}

function createClient(account) {
  const cfg = loadConfig();
  if (clientFactory) {
    return clientFactory(account, cfg);
  }
  if (cfg.mock) {
    return new MockVoiceDocClient(cfg);
  }
  if (!cfg.password) {
    throw configMissing('VOICEDOC_PASSWORD');
  }
  if (account) {
    return new VoiceDocClient({ ...cfg, email: account, forceLogin: true });
  }
  if (!cfg.email) {
    throw configMissing('VOICEDOC_EMAIL');
  }
  return new VoiceDocClient(cfg);
}

function getClient(account) {
  if (clientOverride) {
    return clientOverride;
  }
  const key = accountKey(account);
  if (!clients.has(key)) {
    clients.set(key, createClient(account));
  }
  return clients.get(key);
}

function setClient(c) {
  clientOverride = c;
  clients.clear();
  lanes.clear();
  failedLogins.clear();
}

function setClientFactory(fn) {
  clientFactory = fn;
  clients.clear();
  lanes.clear();
  failedLogins.clear();
}

function runInLane(fn, account) {
  const key = accountKey(account);
  const result = (lanes.get(key) || Promise.resolve()).then(() => fn());
  lanes.set(key, result.then(() => undefined, () => undefined));
  return result;
}

function doctorAccount(userId) {
  const id = String(userId || '').trim();
  return id ? `${id}@${DOCTOR_EMAIL_DOMAIN}` : null;
}

async function resolveAccount(userId, now = Date.now()) {
  const cfg = loadConfig();
  const account = cfg.doctorAccounts ? doctorAccount(userId) : null;
  if (!account || (failedLogins.get(account) || 0) > now) {
    return null;
  }
  try {
    const client = getClient(account);
    if (typeof client.ensureSession === 'function') {
      await client.ensureSession();
    }
    failedLogins.delete(account);
    return account;
  } catch (err) {
    failedLogins.set(account, now + cfg.doctorLoginRetryMs);
    clients.delete(account);
    err.account = account;
    throw err;
  }
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

function visitSummaryName(recordingName) {
  return String(recordingName || '').trim().split(/\s+/)[0] || null;
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
  setClientFactory,
  runInLane,
  doctorAccount,
  resolveAccount,
  withRetry,
  buildRecordingName,
  visitSummaryName,
  parseSummary,
  configMissing,
};
