'use strict';

function envValue(name) {
  const raw = process.env[name];
  if (!raw) {
    return '';
  }
  return raw.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
}

function envBool(name, fallback) {
  const value = envValue(name).toLowerCase();
  if (!value) {
    return fallback;
  }
  return value === 'true';
}

function envInt(name, fallback) {
  const value = Number.parseInt(envValue(name), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const DEFAULT_FIELDS = [
  'Vitals',
  'Allergy',
  'Chief Complaints and HOPI',
  'Diagnosis',
  'Orders and Procedures',
  'Medications',
  'Advice and Instructions',
  'Referral',
  'Physical Examination',
  'ROS',
  'Followup',
  'Family History',
  'Past History',
  'Medical Note',
  'Doctor Notes',
  'Plan of Care',
  'Lab Results',
  'Diet Advice',
  'Examination',
  'Personal History',
  'Confidential Notes',
  'Admission and Surgery Advice',
  'ICD-10 Codes',
];

function loadConfig() {
  return {
    authBaseUrl: envValue('VOICEDOC_AUTH_URL') || 'https://intelehealth-auth-tyohwkctkq-el.a.run.app',
    coreBaseUrl: envValue('VOICEDOC_CORE_URL') || 'https://core-tyohwkctkq-el.a.run.app',
    helperBaseUrl: envValue('VOICEDOC_HELPER_URL') || 'https://intelehealth-helper-service-tyohwkctkq-el.a.run.app',
    email: envValue('VOICEDOC_EMAIL'),
    password: envValue('VOICEDOC_PASSWORD'),
    mock: envBool('VOICEDOC_MOCK', false),
    forceLogin: envBool('VOICEDOC_FORCE_LOGIN', true),
    encryptAudio: envBool('VOICEDOC_ENCRYPT_AUDIO', true),
    language: envValue('VOICEDOC_LANGUAGE') || 'auto',
    timeZone: envValue('VOICEDOC_TIMEZONE') || 'Asia/Kolkata',
    maxPendingChunks: envInt('VOICEDOC_MAX_PENDING_CHUNKS', 90),
    endStreamTimeoutMs: envInt('VOICEDOC_END_STREAM_TIMEOUT_MS', 600000),
    configServiceUrl: envValue('CONFIG_SERVICE_URL'),
  };
}

module.exports = { envValue, loadConfig, DEFAULT_FIELDS };
