'use strict';
const { logStream } = require('../../logger/index');

const ADMIN_ROLE = 'organizational: system administrator';
const ADMIN_TTL_MS = 5 * 60 * 1000;
const LOOKUP_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const REST = '/openmrs/ws/rest/v1';
const NOTE_CONCEPT = '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const VISIT_NOTE_ENCOUNTER_TYPES = ['d7151f82-c1f3-4152-a605-2f9ea7414a79', '086f323a-b90b-49aa-a3ca-fb9ed8ab7426'];

let httpOverride = null;
const caches = new Map();

function getHttp() {
  if (httpOverride) {
    return httpOverride;
  }
  return require('../../handlers/helper').axiosInstance;
}

function setHttp(http) {
  httpOverride = http;
}

function cacheFor(name) {
  if (!caches.has(name)) {
    caches.set(name, new Map());
  }
  return caches.get(name);
}

function clearCaches() {
  caches.clear();
}

function cached(name, key, ttlMs, load) {
  const cache = cacheFor(name);
  const hit = cache.get(key);
  if (hit && (hit.pending || hit.expiresAt > Date.now())) {
    return hit.promise;
  }
  const entry = { pending: true, promise: null, expiresAt: 0 };
  entry.promise = Promise.resolve()
    .then(load)
    .then(
      (value) => {
        entry.pending = false;
        entry.expiresAt = Date.now() + ttlMs;
        return value;
      },
      (err) => {
        cache.delete(key);
        throw err;
      }
    );
  cache.set(key, entry);
  return entry.promise;
}

async function get(path) {
  const res = await getHttp().get(`${REST}${path}`, { timeout: REQUEST_TIMEOUT_MS });
  return res.data;
}

async function post(path, body) {
  const res = await getHttp().post(`${REST}${path}`, body, { timeout: REQUEST_TIMEOUT_MS });
  return res.data;
}

function isNotFound(err) {
  const status = err && err.response && err.response.status;
  return status === 404 || status === 400;
}

function hasAdminRole(user) {
  const roles = Array.isArray(user && user.roles) ? user.roles : [];
  return roles.some((role) => [role && role.name, role && role.display]
    .some((v) => typeof v === 'string' && v.trim().toLowerCase() === ADMIN_ROLE));
}

function isAdmin(userId) {
  if (!userId) {
    return Promise.reject(new Error('userId is missing'));
  }
  return cached('admin', userId, ADMIN_TTL_MS, async () => {
    const user = await get(`/user/${encodeURIComponent(userId)}?v=custom:(uuid,roles:(name,display))`);
    return hasAdminRole(user);
  });
}

function lookup(name, uuid, load) {
  if (!uuid) {
    return Promise.resolve(null);
  }
  return cached(name, uuid, LOOKUP_TTL_MS, async () => {
    try {
      return await load();
    } catch (err) {
      if (isNotFound(err)) {
        return null;
      }
      throw err;
    }
  }).catch((err) => {
    logStream('error', `VoiceDoc ${name} lookup for ${uuid} failed: ${err.message}`, 'VoiceDoc');
    return null;
  });
}

function patient(uuid) {
  return lookup('patient', uuid, async () => {
    const data = await get(`/patient/${encodeURIComponent(uuid)}?v=custom:(uuid,person:(display),identifiers:(identifier,preferred))`);
    const identifiers = Array.isArray(data && data.identifiers) ? data.identifiers : [];
    const preferred = identifiers.find((i) => i && i.preferred) || identifiers[0];
    return {
      name: (data && data.person && data.person.display) || null,
      identifier: (preferred && preferred.identifier) || null,
    };
  });
}

function personName(uuid) {
  return lookup('person', uuid, async () => {
    let data = null;
    try {
      data = await get(`/provider/${encodeURIComponent(uuid)}?v=custom:(uuid,person:(display))`);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
    if (!data || !data.person) {
      data = await get(`/user/${encodeURIComponent(uuid)}?v=custom:(uuid,person:(display))`);
    }
    return (data && data.person && data.person.display) || null;
  });
}

async function findVisitNoteEncounter(visitUuid) {
  const data = await get(`/visit/${encodeURIComponent(visitUuid)}?v=custom:(uuid,encounters:(uuid,voided,encounterDatetime,encounterType:(uuid)))`);
  const encounters = (Array.isArray(data && data.encounters) ? data.encounters : [])
    .filter((e) => e && !e.voided && VISIT_NOTE_ENCOUNTER_TYPES.includes(e.encounterType && e.encounterType.uuid))
    .sort((a, b) => new Date(b.encounterDatetime || 0) - new Date(a.encounterDatetime || 0));
  return encounters.length ? encounters[0].uuid : null;
}

async function liveObs(uuid) {
  try {
    const obs = await get(`/obs/${encodeURIComponent(uuid)}?v=custom:(uuid,voided)`);
    return obs && !obs.voided ? obs : null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function upsertNote({ patientUuid, encounterUuid, value, obsUuid }) {
  if (obsUuid && await liveObs(obsUuid)) {
    const updated = await post(`/obs/${encodeURIComponent(obsUuid)}`, { value });
    return { uuid: (updated && updated.uuid) || obsUuid, updated: true };
  }
  const created = await post('/obs', {
    concept: NOTE_CONCEPT,
    person: patientUuid,
    obsDatetime: new Date().toISOString(),
    value,
    encounter: encounterUuid,
  });
  return { uuid: created && created.uuid, updated: false };
}

async function resolveNames(rows) {
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const patients = unique(rows.map((r) => r.patient_id));
  const people = unique(rows.flatMap((r) => [r.doctor_id, r.chw_id]));
  const [patientResults, peopleResults] = await Promise.all([
    Promise.all(patients.map((uuid) => patient(uuid))),
    Promise.all(people.map((uuid) => personName(uuid))),
  ]);
  return {
    patients: new Map(patients.map((uuid, i) => [uuid, patientResults[i]])),
    people: new Map(people.map((uuid, i) => [uuid, peopleResults[i]])),
  };
}

module.exports = {
  ADMIN_ROLE,
  NOTE_CONCEPT,
  VISIT_NOTE_ENCOUNTER_TYPES,
  setHttp,
  clearCaches,
  hasAdminRole,
  isAdmin,
  patient,
  personName,
  resolveNames,
  findVisitNoteEncounter,
  upsertNote,
};
