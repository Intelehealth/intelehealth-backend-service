'use strict';
const { loadConfig } = require('./config');
const { logStream } = require('../../logger/index');

const SOURCES = ['webapp', 'mobile'];
const CACHE_TTL_MS = 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 15 * 1000;
const FETCH_TIMEOUT_MS = 5000;

let cached = null;
let nextFetchAt = 0;
let inflight = null;
let override = null;
let noteOverride = null;

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true';
  }
  return false;
}

function toObject(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseFlags(published) {
  const source = toObject(published);
  const voice = toObject(source.ai_llm_voice_transcript);
  return {
    section: toBool(source.ai_llm_voice_transcript_section),
    record_transcribe_webapp: toBool(voice.record_transcribe_webapp),
    record_transcribe_mobile: toBool(voice.record_transcribe_mobile),
    feed_ai_ddx: toBool(voice.feed_ai_ddx),
    autofill_doctor_notes: toBool(voice.autofill_doctor_notes),
  };
}

async function fetchPublished() {
  const base = loadConfig().configServiceUrl.replace(/\/+$/, '');
  if (!base) {
    throw new Error('CONFIG_SERVICE_URL is not configured');
  }
  const res = await fetch(`${base}/config/getPublishedConfig`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`config service answered ${res.status}`);
  }
  return res.json();
}

async function refresh(now) {
  try {
    cached = parseFlags(await fetchPublished());
    nextFetchAt = now + CACHE_TTL_MS;
  } catch (err) {
    nextFetchAt = now + RETRY_AFTER_FAILURE_MS;
    logStream('error', `VoiceDoc flag fetch failed: ${err.message}`, 'VoiceDoc');
  }
  return cached;
}

async function getFlags(now = Date.now()) {
  if (now < nextFetchAt) {
    return cached;
  }
  if (!inflight) {
    inflight = refresh(now).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function isRecordingEnabled(source) {
  if (override) {
    return override(source);
  }
  if (!SOURCES.includes(source)) {
    return false;
  }
  const flags = await getFlags();
  return Boolean(flags && flags.section && flags[`record_transcribe_${source}`] === true);
}

async function isNoteAutofillEnabled() {
  if (noteOverride) {
    return noteOverride();
  }
  const flags = await getFlags();
  return Boolean(flags && flags.section && flags.autofill_doctor_notes === true);
}

function setNoteOverride(fn) {
  noteOverride = fn;
}

function setOverride(fn) {
  override = fn;
}

function reset() {
  cached = null;
  nextFetchAt = 0;
  inflight = null;
}

module.exports = {
  SOURCES,
  CACHE_TTL_MS,
  toBool,
  toObject,
  parseFlags,
  getFlags,
  isRecordingEnabled,
  isNoteAutofillEnabled,
  setOverride,
  setNoteOverride,
  reset,
};
