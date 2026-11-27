'use strict';
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('crypto');

process.env.VOICEDOC_MOCK = 'true';
process.env.VOICEDOC_ENCRYPT_AUDIO = 'true';
process.env.VOICEDOC_MAX_PENDING_CHUNKS = '90';

const voicedoc = require('../services/voicedoc');
const { encryptChunk, importPublicKey } = require('../services/voicedoc/encryption');
const service = require('../services/voicedoc.service');
const flags = require('../services/voicedoc/flags');
const openmrs = require('../services/voicedoc/openmrs');

flags.setNoteOverride(async () => false);

const { subtle } = webcrypto;

describe('loadConfig', () => {
  const { loadConfig } = require('../services/voicedoc/config');
  const saved = {};
  beforeEach(() => {
    for (const k of ['CONFIG_SERVICE_URL', 'DOMAIN']) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('derives the config service url from DOMAIN when CONFIG_SERVICE_URL is unset', () => {
    delete process.env.CONFIG_SERVICE_URL;
    process.env.DOMAIN = 'ttxai.intelehealth.org';
    assert.equal(loadConfig().configServiceUrl, 'https://ttxai.intelehealth.org:4004/api');
  });

  test('prefers an explicit CONFIG_SERVICE_URL', () => {
    process.env.CONFIG_SERVICE_URL = 'http://localhost:4004/api';
    process.env.DOMAIN = 'ttxai.intelehealth.org';
    assert.equal(loadConfig().configServiceUrl, 'http://localhost:4004/api');
  });

  test('is empty when neither is set', () => {
    delete process.env.CONFIG_SERVICE_URL;
    delete process.env.DOMAIN;
    assert.equal(loadConfig().configServiceUrl, '');
  });

  test('defaults everything except the credentials', () => {
    const cfg = loadConfig();
    assert.ok(cfg.authBaseUrl && cfg.coreBaseUrl && cfg.helperBaseUrl);
    assert.equal(cfg.forceLogin, true);
    assert.equal(cfg.language, 'auto');
    assert.equal(cfg.timeZone, 'Asia/Kolkata');
  });
});

describe('buildRecordingName', () => {
  test('formats MR-<pid>_<vid> with a local timestamp', () => {
    const now = new Date('2026-10-30T04:35:00Z');
    assert.equal(
      voicedoc.buildRecordingName('pid-1', 'vid-2', 'Asia/Kolkata', now),
      'MR-pid-1_vid-2 Oct 30 2026 10:05 AM'
    );
  });

  test('falls back to UNKNOWN when the patient is missing', () => {
    const now = new Date('2026-10-30T04:35:00Z');
    assert.equal(voicedoc.buildRecordingName('', 'vid-2', 'Asia/Kolkata', now), 'MR-UNKNOWN_vid-2 Oct 30 2026 10:05 AM');
  });
  test('visitSummaryName strips the timestamp', () => {
    assert.equal(voicedoc.visitSummaryName('MR-pid-1_vid-2 Oct 30 2026 10:05 AM'), 'MR-pid-1_vid-2');
    assert.equal(voicedoc.visitSummaryName(''), null);
  });
});

describe('withRetry', () => {
  const failing = (status, okAfter) => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (okAfter && calls > okAfter) return 'ok';
      const err = new Error('boom');
      if (status) err.status = status;
      throw err;
    };
    return { fn, calls: () => calls };
  };

  test('retries status-less errors until success', async () => {
    const f = failing(undefined, 2);
    assert.equal(await voicedoc.withRetry(f.fn, 5, 1), 'ok');
    assert.equal(f.calls(), 3);
  });

  test('retries 429 and 503', async () => {
    const a = failing(429, 1);
    assert.equal(await voicedoc.withRetry(a.fn, 5, 1), 'ok');
    assert.equal(a.calls(), 2);
    const b = failing(503, 1);
    assert.equal(await voicedoc.withRetry(b.fn, 5, 1), 'ok');
    assert.equal(b.calls(), 2);
  });

  test('does not retry 400', async () => {
    const f = failing(400);
    await assert.rejects(voicedoc.withRetry(f.fn, 5, 1), { status: 400 });
    assert.equal(f.calls(), 1);
  });

  test('gives up after 5 attempts', async () => {
    const f = failing(503);
    await assert.rejects(voicedoc.withRetry(f.fn, 5, 1), { status: 503 });
    assert.equal(f.calls(), 5);
  });
});

describe('runInLane', () => {
  test('runs jobs one at a time in order and continues after a rejection', async () => {
    const order = [];
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const a = voicedoc.runInLane(async () => { order.push('a:start'); await delay(20); order.push('a:end'); return 'a'; });
    const b = voicedoc.runInLane(async () => { order.push('b'); throw new Error('b failed'); });
    const c = voicedoc.runInLane(async () => { order.push('c'); return 'c'; });
    assert.equal(await a, 'a');
    await assert.rejects(b, /b failed/);
    assert.equal(await c, 'c');
    assert.deepEqual(order, ['a:start', 'a:end', 'b', 'c']);
  });
});

describe('encryptChunk', () => {
  test('round-trips through RSA-OAEP unwrap and AES-GCM decrypt, and rejects an AAD mismatch', async () => {
    const { publicKey, privateKey } = await subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['wrapKey', 'unwrapKey']
    );
    const spki = Buffer.from(await subtle.exportKey('spki', publicKey)).toString('base64');
    const imported = await importPublicKey(spki);
    const plain = Buffer.from('RIFF fake wav bytes');
    const { ciphertext, encryptedKey, iv } = await encryptChunk(imported, plain, 'abc123', 7);

    const aesKey = await subtle.unwrapKey(
      'raw',
      Buffer.from(encryptedKey, 'base64'),
      privateKey,
      { name: 'RSA-OAEP' },
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const ivBytes = Buffer.from(iv, 'base64');
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes, additionalData: new TextEncoder().encode('abc123:7') },
      aesKey,
      ciphertext
    );
    assert.equal(Buffer.from(decrypted).toString(), plain.toString());

    await assert.rejects(subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes, additionalData: new TextEncoder().encode('abc123:8') },
      aesKey,
      ciphertext
    ));
  });
});

describe('VoiceDocClient.login', () => {
  const realFetch = global.fetch;
  let calls;

  const cfg = {
    authBaseUrl: 'https://auth.test',
    coreBaseUrl: 'https://core.test',
    helperBaseUrl: 'https://helper.test',
    email: 'demo@example.com',
    password: 'secret',
    forceLogin: true,
  };

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  test('parses a double-JSON-encoded login body and registers the session', async () => {
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      if (url.endsWith('/api/auth/login_wrapper')) {
        return new Response(JSON.stringify(JSON.stringify({ token: 'tok-1', refreshtoken: 'ref-1' })), { status: 200 });
      }
      if (url.endsWith('/registerSession')) {
        return new Response('{}', { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    };
    const client = new voicedoc.VoiceDocClient(cfg);
    await client.login();
    assert.equal(client.session.token, 'tok-1');
    assert.equal(client.session.refreshToken, 'ref-1');
    assert.deepEqual(JSON.parse(calls[0].opts.body), { email: 'demo@example.com', pkd: 'secret' });
    assert.equal(calls[1].opts.method, 'PUT');
    assert.equal(calls[1].opts.headers.Authorization, 'Bearer tok-1');
    assert.ok(calls.every((c) => c.opts.signal));
  });

  test('logs out and retries once when the account is already logged in', async () => {
    let logins = 0;
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      if (url.endsWith('/api/auth/login_wrapper')) {
        logins++;
        if (logins === 1) {
          return new Response(JSON.stringify({ detail: 'User is already logged in.' }), { status: 401 });
        }
        return new Response(JSON.stringify({ token: 'tok-2', refreshtoken: 'ref-2' }), { status: 200 });
      }
      if (url.endsWith('/logout')) {
        return new Response('"User Logged out"', { status: 200 });
      }
      if (url.endsWith('/registerSession')) {
        return new Response('{}', { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    };
    const client = new voicedoc.VoiceDocClient(cfg);
    await client.login();
    assert.deepEqual(calls.map((c) => new URL(c.url).pathname), [
      '/api/auth/login_wrapper',
      '/logout',
      '/api/auth/login_wrapper',
      '/registerSession',
    ]);
    assert.deepEqual(JSON.parse(calls[1].opts.body), { emailid: 'demo@example.com' });
    assert.equal(client.session.token, 'tok-2');
  });

  test('does not loop when the account stays logged in', async () => {
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      if (url.endsWith('/logout')) return new Response('', { status: 200 });
      return new Response(JSON.stringify({ detail: 'User is already logged in.' }), { status: 401 });
    };
    const client = new voicedoc.VoiceDocClient(cfg);
    await assert.rejects(client.login(), { status: 401 });
    assert.equal(calls.length, 3);
  });
});

function stubModel() {
  const rows = new Map();
  let seq = 0;
  return {
    rows,
    async create(attrs) {
      const row = { id: ++seq, chunks_received: 0, chunks_uploaded: 0, chunks_failed: 0, error: null, transcript: null, summary: null, ended_at: null, ...attrs };
      rows.set(row.id, row);
      return { ...row };
    },
    async findByPk(id) {
      const row = rows.get(Number(id));
      return row ? { ...row } : null;
    },
    async increment(field, { where }) {
      rows.get(Number(where.id))[field]++;
    },
    async update(values, { where }) {
      Object.assign(rows.get(Number(where.id)), values);
    },
    async findAll({ where }) {
      return [...rows.values()]
        .filter((r) => r.visit_id === where.visit_id)
        .sort((a, b) => b.started_at - a.started_at);
    },
  };
}

function chunkStub() {
  const rows = new Map();
  const key = (v) => `${v.call_transcript_id}:${v.chunk_number}`;
  const matches = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    rows,
    get: (sessionId, n) => rows.get(`${sessionId}:${n}`),
    async upsert(values) {
      rows.set(key(values), { ...rows.get(key(values)), ...values });
    },
    async bulkCreate(list, opts) {
      assert.equal(opts.ignoreDuplicates, true);
      for (const values of list) {
        if (!rows.has(key(values))) rows.set(key(values), { ...values });
      }
    },
    async update(values, { where }) {
      for (const row of rows.values()) {
        if (matches(row, where)) Object.assign(row, values);
      }
    },
  };
}

function wavOf(seconds) {
  const dataBytes = seconds * 16000 * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

async function waitFor(check, label) {
  for (let i = 0; i < 300; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function waitForStatus(model, id, statuses) {
  for (let i = 0; i < 200; i++) {
    const row = model.rows.get(id);
    if (statuses.includes(row.status)) return row;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`status stuck at ${model.rows.get(id).status}`);
}

describe('voicedoc.service', () => {
  let model;

  beforeEach(() => {
    model = stubModel();
    service.setModel(model);
    service.setChunkModel(chunkStub());
    voicedoc.setClient(new voicedoc.MockVoiceDocClient({ delayScale: 0 }));
    flags.setOverride(async () => true);
  });

  afterEach(() => {
    service.setModel(null);
    service.setChunkModel(null);
    voicedoc.setClient(null);
    flags.setOverride(null);
    flags.setNoteOverride(async () => false);
    openmrs.setHttp(null);
  });

  const session = () => service.createSession({ visitUuid: 'visit-1', patientUuid: 'patient-1', doctorUuid: 'doctor-1' });

  const VISIT_NOTE = 'd7151f82-c1f3-4152-a605-2f9ea7414a79';
  const openmrsHttp = (encounters, calls, obsState = {}) => ({
    async get(url) {
      calls.push(['GET', url]);
      if (url.includes('/visit/')) return { data: { uuid: 'visit-1', encounters } };
      const uuid = url.split('/obs/')[1].split('?')[0];
      if (!obsState[uuid]) throw Object.assign(new Error('nf'), { response: { status: 404 } });
      return { data: { uuid, voided: obsState[uuid] === 'voided' } };
    },
    async post(url, body) {
      calls.push(['POST', url, body]);
      const uuid = `obs-${calls.filter((c) => c[0] === 'POST').length}`;
      obsState[uuid] = 'live';
      return { data: { uuid } };
    },
  });
  const finished = async () => {
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, Buffer.from('one'), 1);
    await service.endSession(sessionId);
    await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    for (let i = 0; i < 50 && !model.rows.get(sessionId).note_status; i++) await new Promise((r) => setTimeout(r, 5));
    return model.rows.get(sessionId);
  };

  test('finalize stores the summary of all visit recordings and skips the note when autofill is off', async () => {
    const calls = [];
    openmrs.setHttp(openmrsHttp([], calls));
    const row = await finished();
    assert.equal(row.status, 'done');
    assert.ok(row.visit_summary.length > 0);
    assert.equal(row.visit_summary_response.visits_found, 1);
    assert.ok(row.visit_summary_at instanceof Date);
    assert.equal(row.note_status, 'disabled');
    assert.equal(calls.length, 0);
    const detail = await service.getTranscript(row.id);
    assert.equal(detail.visitSummary, row.visit_summary);
    assert.equal(detail.noteStatus, 'disabled');
  });

  test('saves the visit summary as a doctor note on the latest visit note encounter, then updates that note', async () => {
    flags.setNoteOverride(async () => true);
    const calls = [];
    const obsState = {};
    openmrs.setHttp(openmrsHttp([
      { uuid: 'enc-old', voided: false, encounterDatetime: '2026-11-04T09:00:00Z', encounterType: { uuid: VISIT_NOTE } },
      { uuid: 'enc-voided', voided: true, encounterDatetime: '2026-11-04T11:00:00Z', encounterType: { uuid: VISIT_NOTE } },
      { uuid: 'enc-other', voided: false, encounterDatetime: '2026-11-04T12:00:00Z', encounterType: { uuid: 'adult-initial' } },
      { uuid: 'enc-1', voided: false, encounterDatetime: '2026-11-04T10:00:00Z', encounterType: { uuid: VISIT_NOTE } },
    ], calls, obsState));

    const first = await finished();
    assert.equal(first.note_status, 'saved');
    assert.equal(first.note_obs_uuid, 'obs-1');
    const [, url, body] = calls.find((c) => c[0] === 'POST');
    assert.equal(url, '/openmrs/ws/rest/v1/obs');
    assert.equal(body.concept, '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    assert.equal(body.person, 'patient-1');
    assert.equal(body.encounter, 'enc-1');
    assert.equal(body.value, first.visit_summary);

    const second = await finished();
    assert.equal(second.visit_summary_response.visits_found, 2);
    assert.equal(second.note_status, 'updated');
    const update = calls.filter((c) => c[0] === 'POST')[1];
    assert.equal(update[1], '/openmrs/ws/rest/v1/obs/obs-1');
    assert.deepEqual(update[2], { value: second.visit_summary });
    assert.equal(second.note_obs_uuid, 'obs-2');

    obsState['obs-2'] = 'voided';
    const third = await finished();
    assert.equal(third.note_status, 'saved');
    assert.equal(calls.filter((c) => c[0] === 'POST')[2][1], '/openmrs/ws/rest/v1/obs');
  });

  test('records no_encounter when the visit has no visit note encounter', async () => {
    flags.setNoteOverride(async () => true);
    openmrs.setHttp(openmrsHttp([], []));
    const row = await finished();
    assert.equal(row.note_status, 'no_encounter');
    assert.equal(row.note_obs_uuid, undefined);
  });

  test('regenerateVisitSummary validates the transcript and maps VoiceDoc failures to 502', async () => {
    openmrs.setHttp(openmrsHttp([], []));
    await assert.rejects(service.regenerateVisitSummary('999'), { status: 404 });
    await assert.rejects(service.regenerateVisitSummary('abc'), { status: 404 });
    const pendingSession = await session();
    await assert.rejects(service.regenerateVisitSummary(pendingSession.sessionId), { status: 409 });
    const row = await finished();
    const detail = await service.regenerateVisitSummary(row.id);
    assert.ok(detail.visitSummary.length > 0);
    voicedoc.setClient({
      prepare: async () => {},
      patientVisitSummary: async () => { throw Object.assign(new Error('bad'), { status: 400 }); },
    });
    await assert.rejects(service.regenerateVisitSummary(row.id), { status: 502, code: 'VOICEDOC_VISIT_SUMMARY_FAILED' });
  });

  test('create, two chunks, end and finalize yields done with a transcript', async () => {
    const { sessionId, chunkId, name } = await session();
    assert.match(chunkId, /^[0-9a-f]{32}$/);
    assert.match(name, /^MR-patient-1_visit-1 /);

    const first = await service.enqueueChunk(sessionId, Buffer.from('one'), 1);
    assert.equal(first.chunkNumber, 1);
    await service.enqueueChunk(sessionId, Buffer.from('two'), 2);

    const ended = await service.endSession(sessionId);
    assert.deepEqual(ended, { sessionId, status: 'finalizing' });

    const row = await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    assert.equal(row.status, 'done');
    assert.equal(row.chunks_received, 2);
    assert.equal(row.chunks_uploaded, 2);
    assert.equal(row.chunks_failed, 0);
    assert.match(row.transcript, /Doctor:/);
    assert.equal(row.summary.Diagnosis, 'Acute febrile illness, rule out malaria');
    assert.ok(row.ended_at instanceof Date);

    await assert.rejects(service.enqueueChunk(sessionId, Buffer.from('late'), 3), { status: 409 });
    const again = await service.endSession(sessionId);
    assert.equal(again.alreadyEnded, true);

    const list = await service.getByVisit('visit-1');
    assert.equal(list.length, 1);
  });

  test('ending with zero chunks yields empty', async () => {
    const { sessionId } = await session();
    await service.endSession(sessionId);
    const row = await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    assert.equal(row.status, 'empty');
    assert.equal(row.error, 'no chunks uploaded');
  });

  test('unknown session returns 404', async () => {
    await assert.rejects(service.enqueueChunk(999, Buffer.from('x'), 1), { status: 404 });
    await assert.rejects(service.endSession(999), { status: 404 });
  });

  test('a failing end-stream marks the session as error', async () => {
    const client = new voicedoc.MockVoiceDocClient({ delayScale: 0 });
    client.endStream = async () => { const err = new Error('bad request'); err.status = 400; throw err; };
    voicedoc.setClient(client);
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, Buffer.from('one'), 1);
    await service.endSession(sessionId);
    const row = await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    assert.equal(row.status, 'error');
    assert.equal(row.error, 'bad request');
  });
});

describe('chunk metadata', () => {
  test('levels are clamped to [0, 1] and non-numeric values are ignored', () => {
    assert.deepEqual(service.parseChunkMeta({
      localRms: '0.25',
      localPeak: '1.7',
      remoteRms: '-0.2',
      remotePeak: 'loud',
      localSources: '2',
      remoteSources: '-3',
    }), {
      local_rms: 0.25,
      local_peak: 1,
      remote_rms: 0,
      remote_peak: null,
      local_sources: 2,
      remote_sources: 0,
    });
  });

  test('missing, empty, array and non-finite values become null; sources are rounded integers', () => {
    const meta = service.parseChunkMeta({ localRms: '', localPeak: ['0.5'], remoteRms: 'Infinity', remotePeak: ' 0.5 ', localSources: '1.6', remoteSources: 'x' });
    assert.deepEqual(meta, {
      local_rms: null,
      local_peak: null,
      remote_rms: null,
      remote_peak: 0.5,
      local_sources: 2,
      remote_sources: null,
    });
    const none = service.parseChunkMeta(undefined);
    assert.ok(Object.values(none).every((v) => v === null));
    assert.equal(Object.keys(none).length, 6);
  });

  test('duration comes from the WAV header, or from the size for 16 kHz mono 16-bit', () => {
    assert.equal(service.wavDurationMs(wavOf(10)), 10000);
    assert.equal(service.wavDurationMs(Buffer.alloc(44 + 32000)), 1000);
    assert.equal(service.wavDurationMs(Buffer.from('tiny')), 0);
  });

  test('jsonColumn keeps objects and wraps non-JSON text', () => {
    assert.deepEqual(service.jsonColumn({ a: 1 }), { a: 1 });
    assert.deepEqual(service.jsonColumn('<html>bad gateway</html>'), { raw: '<html>bad gateway</html>' });
    assert.equal(service.jsonColumn(null), null);
    assert.equal(service.jsonColumn(undefined), null);
  });
});

describe('VoiceDocClient.uploadChunk', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const client = () => {
    const c = new voicedoc.VoiceDocClient({ coreBaseUrl: 'https://core.test' });
    c.session = { token: 'tok' };
    return c;
  };
  const args = { wav: Buffer.from('RIFF'), chunkId: 'abc', chunkNumber: 3, name: 'MR-x', language: 'auto', encrypt: false };

  test('returns the parsed response body', async () => {
    global.fetch = async () => new Response(JSON.stringify({ status: 'ok', chunk_number: 3, blob: '' }), { status: 200 });
    assert.deepEqual(await client().uploadChunk(args), { status: 'ok', chunk_number: 3, blob: '' });
  });

  test('returns text for a non-JSON body and throws with status and body on failure', async () => {
    global.fetch = async () => new Response('accepted', { status: 200 });
    assert.equal(await client().uploadChunk(args), 'accepted');
    global.fetch = async () => new Response(JSON.stringify({ detail: 'bad chunk' }), { status: 422 });
    await assert.rejects(client().uploadChunk(args), (err) => {
      assert.equal(err.name, 'VoiceDocError');
      assert.equal(err.status, 422);
      assert.deepEqual(err.body, { detail: 'bad chunk' });
      return true;
    });
  });
});

describe('chunk tracking and raw responses', () => {
  let model;
  let chunks;
  let client;
  let enabled;

  beforeEach(() => {
    model = stubModel();
    chunks = chunkStub();
    service.setModel(model);
    service.setChunkModel(chunks);
    client = new voicedoc.MockVoiceDocClient({ delayScale: 0 });
    voicedoc.setClient(client);
    enabled = true;
    flags.setOverride(async () => enabled);
  });

  afterEach(() => {
    service.setModel(null);
    service.setChunkModel(null);
    voicedoc.setClient(null);
    flags.setOverride(null);
  });

  const session = () => service.createSession({ visitUuid: 'visit-1', patientUuid: 'patient-1', doctorUuid: 'doctor-1' });
  const levels = { localRms: '0.12', localPeak: '0.8', remoteRms: '0.05', remotePeak: '0.4', localSources: '1', remoteSources: '2' };

  test('a chunk is queued with size, duration and levels, then uploaded with the response', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    client.uploadChunk = async ({ chunkNumber }) => {
      await gate;
      return { status: 'ok', chunk_number: chunkNumber, blob: '' };
    };
    const { sessionId } = await session();
    const wav = wavOf(2);
    await service.enqueueChunk(sessionId, wav, 1, levels);

    const queued = chunks.get(sessionId, 1);
    assert.equal(queued.status, 'queued');
    assert.equal(queued.attempts, 0);
    assert.equal(queued.bytes, wav.length);
    assert.equal(queued.duration_ms, 2000);
    assert.equal(queued.local_rms, 0.12);
    assert.equal(queued.local_peak, 0.8);
    assert.equal(queued.remote_rms, 0.05);
    assert.equal(queued.remote_peak, 0.4);
    assert.equal(queued.local_sources, 1);
    assert.equal(queued.remote_sources, 2);

    release();
    await waitFor(() => chunks.get(sessionId, 1).status === 'uploaded', 'uploaded');
    const done = chunks.get(sessionId, 1);
    assert.equal(done.attempts, 1);
    assert.deepEqual(done.response, { status: 'ok', chunk_number: 1, blob: '' });
    assert.equal(done.error, null);
    assert.ok(done.uploaded_at instanceof Date);
    await waitFor(() => model.rows.get(sessionId).chunks_uploaded === 1, 'counter');
  });

  test('a retried chunk records every attempt', async () => {
    let calls = 0;
    client.uploadChunk = async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('unavailable'), { status: 503 });
      return { status: 'ok', chunk_number: 1, blob: '' };
    };
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, {});
    await waitFor(() => chunks.get(sessionId, 1).status === 'uploaded', 'uploaded');
    assert.equal(chunks.get(sessionId, 1).attempts, 2);
  });

  test('a chunk that finally fails is marked failed with the error, attempts and body', async () => {
    client.uploadChunk = async () => { throw Object.assign(new Error('bad chunk'), { status: 400, body: { detail: 'bad chunk' } }); };
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, levels);
    await waitFor(() => chunks.get(sessionId, 1).status === 'failed', 'failed');
    const row = chunks.get(sessionId, 1);
    assert.equal(row.attempts, 1);
    assert.equal(row.error, 'bad chunk');
    assert.deepEqual(row.response, { detail: 'bad chunk' });
    assert.equal(row.local_rms, 0.12);
    await waitFor(() => model.rows.get(sessionId).chunks_failed === 1, 'counter');
  });

  test('chunks dropped after the session ended or was disabled are skipped, without overwriting uploads', async () => {
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, levels);
    enabled = false;
    await assert.rejects(service.enqueueChunk(sessionId, wavOf(1), 2, levels), { status: 403 });
    assert.equal(chunks.get(sessionId, 2).status, 'skipped');
    assert.equal(chunks.get(sessionId, 2).error, 'Voice transcription is disabled');
    assert.equal(chunks.get(sessionId, 2).remote_peak, 0.4);
    enabled = true;
    await service.endSession(sessionId);
    await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    await assert.rejects(service.enqueueChunk(sessionId, wavOf(1), 3, {}), { status: 409 });
    assert.equal(chunks.get(sessionId, 3).status, 'skipped');
    assert.match(chunks.get(sessionId, 3).error, /Transcription session is done/);
    await assert.rejects(service.enqueueChunk(sessionId, wavOf(1), 1, {}), { status: 409 });
    assert.equal(chunks.get(sessionId, 1).status, 'uploaded');
  });

  test('finalize marks chunks still queued (lost from memory) as skipped', async () => {
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, {});
    await chunks.upsert({ call_transcript_id: sessionId, chunk_number: 7, status: 'queued', attempts: 0 });
    await service.endSession(sessionId);
    await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    assert.equal(chunks.get(sessionId, 7).status, 'skipped');
    assert.equal(chunks.get(sessionId, 1).status, 'uploaded');
  });

  test('finalize stores the end-stream and combined-audio responses', async () => {
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, {});
    await service.endSession(sessionId);
    await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    await waitFor(() => model.rows.get(sessionId).combined_audio_response, 'combined audio');
    const row = model.rows.get(sessionId);
    assert.equal(row.status, 'done');
    assert.equal(row.raw_response.message, 'End-stream processing successful');
    assert.equal(row.raw_response.transcript, row.transcript);
    assert.deepEqual(row.raw_response.summary, row.summary);
    assert.deepEqual(row.combined_audio_response, { message: 'Audio Uploaded Successfully' });
  });

  test('non-JSON bodies are stored as { raw } and a combined-audio failure as { error, status }', async () => {
    client.endStream = async () => 'Internal hiccup';
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, {});
    await service.endSession(sessionId);
    const row = await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    assert.equal(row.status, 'empty');
    assert.deepEqual(row.raw_response, { raw: 'Internal hiccup' });
    assert.equal(row.combined_audio_response, undefined);

    voicedoc.setClient(new voicedoc.MockVoiceDocClient({ delayScale: 0 }));
    const second = await session();
    voicedoc.getClient().uploadCombinedAudio = async () => { throw Object.assign(new Error('gateway timeout'), { status: 504, body: '<html>504</html>' }); };
    await service.enqueueChunk(second.sessionId, wavOf(1), 1, {});
    await service.endSession(second.sessionId);
    await waitForStatus(model, second.sessionId, ['done', 'empty', 'error']);
    await waitFor(() => model.rows.get(second.sessionId).combined_audio_response, 'combined audio');
    const failed = model.rows.get(second.sessionId);
    assert.equal(failed.status, 'done');
    assert.deepEqual(failed.combined_audio_response, { error: 'gateway timeout', status: 504, body: { raw: '<html>504</html>' } });
    assert.match(failed.error, /Combined audio was not saved: gateway timeout/);
  });

  test('a failed end-stream keeps its response body in raw_response', async () => {
    client.endStream = async () => { throw Object.assign(new Error('bad request'), { status: 400, body: { detail: 'bad request' } }); };
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, {});
    await service.endSession(sessionId);
    const row = await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    assert.equal(row.status, 'error');
    assert.deepEqual(row.raw_response, { detail: 'bad request' });
  });

  test('chunk tracking failures never break the upload pipeline', async () => {
    const broken = () => { throw new Error('ER_NO_SUCH_TABLE'); };
    service.setChunkModel({ upsert: broken, bulkCreate: broken, update: broken });
    const uploaded = [];
    client.uploadChunk = async ({ chunkNumber }) => {
      uploaded.push(chunkNumber);
      return { status: 'ok', chunk_number: chunkNumber, blob: '' };
    };
    const { sessionId } = await session();
    await service.enqueueChunk(sessionId, wavOf(1), 1, levels);
    await service.enqueueChunk(sessionId, wavOf(1), 2, levels);
    await service.endSession(sessionId);
    const row = await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    assert.equal(row.status, 'done');
    assert.deepEqual(uploaded, [1, 2]);
    assert.equal(row.chunks_uploaded, 2);
    assert.equal(row.chunks_failed, 0);
    await assert.rejects(service.enqueueChunk(sessionId, wavOf(1), 3, {}), { status: 409 });
  });
});

describe('per-doctor VoiceDoc accounts', () => {
  let model;
  let made;

  const factory = ({ failLogin = [] } = {}) => (account) => {
    const client = new voicedoc.MockVoiceDocClient({ delayScale: 0 });
    client.account = account || 'shared';
    client.logins = 0;
    client.ensureSession = async () => {
      client.logins++;
      if (failLogin.includes(account)) throw Object.assign(new Error('VoiceDoc login failed (401): Incorrect Email Id or Password'), { status: 401 });
    };
    for (const method of ['uploadChunk', 'endStream', 'uploadCombinedAudio', 'patientVisitSummary']) {
      const original = client[method].bind(client);
      client[method] = async (...args) => {
        made.push([client.account, method]);
        return original(...args);
      };
    }
    return client;
  };

  beforeEach(() => {
    made = [];
    model = stubModel();
    service.setModel(model);
    service.setChunkModel(chunkStub());
    flags.setOverride(async () => true);
  });

  afterEach(() => {
    service.setModel(null);
    service.setChunkModel(null);
    voicedoc.setClientFactory(null);
    voicedoc.setClient(null);
    flags.setOverride(null);
    delete process.env.VOICEDOC_DOCTOR_ACCOUNTS;
  });

  const record = async (userId) => {
    const { sessionId } = await service.createSession({ visitUuid: 'visit-1', patientUuid: 'patient-1', doctorUuid: 'doctor-1', userId });
    await service.enqueueChunk(sessionId, Buffer.from('one'), 1);
    await service.endSession(sessionId);
    await waitForStatus(model, sessionId, ['done', 'empty', 'error']);
    for (let i = 0; i < 50 && !model.rows.get(sessionId).visit_summary_at; i++) await new Promise((r) => setTimeout(r, 5));
    return model.rows.get(sessionId);
  };

  test('doctorAccount builds <userId>@intelehealth.org', () => {
    assert.equal(voicedoc.doctorAccount('u-1'), 'u-1@intelehealth.org');
    assert.equal(voicedoc.doctorAccount(''), null);
  });

  test('a session runs every VoiceDoc call through the doctor account', async () => {
    voicedoc.setClientFactory(factory());
    const row = await record('user-1');
    assert.equal(row.status, 'done');
    assert.equal(row.voicedoc_account, 'user-1@intelehealth.org');
    assert.ok(made.length >= 4);
    assert.ok(made.every(([account]) => account === 'user-1@intelehealth.org'));
    assert.ok(row.visit_summary);
    assert.equal((await service.getTranscript(row.id)).voicedocAccount, 'user-1@intelehealth.org');
  });

  test('falls back to the shared account when the doctor login fails, and does not retry the login right away', async () => {
    const make = factory({ failLogin: ['user-2@intelehealth.org'] });
    const created = [];
    voicedoc.setClientFactory((account) => {
      const c = make(account);
      created.push(c);
      return c;
    });
    const row = await record('user-2');
    assert.equal(row.status, 'done');
    assert.equal(row.voicedoc_account, null);
    assert.ok(made.every(([account]) => account === 'shared'));
    await record('user-2');
    const doctorClients = created.filter((c) => c.account === 'user-2@intelehealth.org');
    assert.equal(doctorClients.length, 1);
    assert.equal(doctorClients[0].logins, 1);
  });

  test('uses the shared account without a user id or when VOICEDOC_DOCTOR_ACCOUNTS=false', async () => {
    voicedoc.setClientFactory(factory());
    assert.equal((await record(undefined)).voicedoc_account, null);
    process.env.VOICEDOC_DOCTOR_ACCOUNTS = 'false';
    assert.equal((await record('user-3')).voicedoc_account, null);
    assert.ok(made.every(([account]) => account === 'shared'));
  });
});
