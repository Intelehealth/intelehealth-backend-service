'use strict';
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.VOICEDOC_MOCK = 'true';
process.env.CONFIG_SERVICE_URL = 'http://config.test/api/';

const voicedoc = require('../services/voicedoc');
const flags = require('../services/voicedoc/flags');
const openmrs = require('../services/voicedoc/openmrs');
const service = require('../services/voicedoc.service');
const controller = require('../controllers/voicedoc.controller');

const ITEM_KEYS = [
  'id', 'visitUuid', 'patientUuid', 'patientName', 'patientIdentifier', 'doctorUuid', 'doctorName', 'chwUuid',
  'chwName', 'source', 'status', 'language', 'recordingName', 'chunksReceived', 'chunksUploaded', 'chunksFailed',
  'startedAt', 'endedAt', 'durationSec', 'transcriptPreview', 'hasSummary', 'error',
];

const published = (section, voice) => ({ ai_llm_voice_transcript_section: section, ai_llm_voice_transcript: voice });

describe('flag normalisation', () => {
  test('booleans arrive as bool, number or string', () => {
    for (const v of [true, 1, '1', 'true', ' TRUE ']) assert.equal(flags.toBool(v), true, String(v));
    for (const v of [false, 0, '0', 'false', '', null, undefined, 2, {}]) assert.equal(flags.toBool(v), false, String(v));
  });

  test('the voice object may be a JSON string with numeric values', () => {
    const parsed = flags.parseFlags(published('1', JSON.stringify({
      record_transcribe_webapp: 1,
      record_transcribe_mobile: '0',
      feed_ai_ddx: 'true',
      autofill_doctor_notes: false,
    })));
    assert.deepEqual(parsed, {
      section: true,
      record_transcribe_webapp: true,
      record_transcribe_mobile: false,
      feed_ai_ddx: true,
      autofill_doctor_notes: false,
    });
  });

  test('missing or malformed config parses to all false', () => {
    const off = { section: false, record_transcribe_webapp: false, record_transcribe_mobile: false, feed_ai_ddx: false, autofill_doctor_notes: false };
    assert.deepEqual(flags.parseFlags({}), off);
    assert.deepEqual(flags.parseFlags(published(true, '{not json')), { ...off, section: true });
    assert.deepEqual(flags.parseFlags(null), off);
  });
});

describe('flag fetching', () => {
  const realFetch = global.fetch;
  let calls;
  let respond;

  beforeEach(() => {
    flags.reset();
    calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return respond();
    };
  });

  afterEach(() => {
    global.fetch = realFetch;
    flags.reset();
  });

  const ok = (body) => () => new Response(JSON.stringify(body), { status: 200 });

  test('fetches the published config without auth and caches it for 60 s', async () => {
    respond = ok(published(true, { record_transcribe_webapp: true }));
    const t0 = 1_000_000;
    assert.equal((await flags.getFlags(t0)).record_transcribe_webapp, true);
    await flags.getFlags(t0 + flags.CACHE_TTL_MS - 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://config.test/api/config/getPublishedConfig');
    assert.equal(calls[0].opts.headers, undefined);
    assert.ok(calls[0].opts.signal);
    await flags.getFlags(t0 + flags.CACHE_TTL_MS);
    assert.equal(calls.length, 2);
  });

  test('concurrent callers share one fetch', async () => {
    respond = ok(published(true, {}));
    await Promise.all([flags.getFlags(5), flags.getFlags(5), flags.getFlags(5)]);
    assert.equal(calls.length, 1);
  });

  test('fails closed when nothing was ever fetched', async () => {
    respond = () => { throw new Error('ECONNREFUSED'); };
    assert.equal(await flags.isRecordingEnabled('webapp'), false);
    assert.equal(await flags.getFlags(Date.now() + 10 * 60 * 1000), null);
  });

  test('a non-2xx answer also fails closed', async () => {
    respond = () => new Response('{}', { status: 400 });
    assert.equal(await flags.isRecordingEnabled('webapp'), false);
  });

  test('keeps the last good value when a refresh fails', async () => {
    respond = ok(published(1, { record_transcribe_webapp: 1 }));
    const t0 = 2_000_000;
    assert.equal((await flags.getFlags(t0)).record_transcribe_webapp, true);
    respond = () => { throw new Error('timeout'); };
    const after = await flags.getFlags(t0 + flags.CACHE_TTL_MS + 1);
    assert.equal(calls.length, 2);
    assert.equal(after.section, true);
    assert.equal(after.record_transcribe_webapp, true);
  });

  test('isRecordingEnabled needs the section and the per-source flag', async () => {
    respond = ok(published(true, { record_transcribe_webapp: true, record_transcribe_mobile: false }));
    assert.equal(await flags.isRecordingEnabled('webapp'), true);
    assert.equal(await flags.isRecordingEnabled('mobile'), false);
    assert.equal(await flags.isRecordingEnabled('desktop'), false);
    flags.reset();
    respond = ok(published(false, { record_transcribe_webapp: true }));
    assert.equal(await flags.isRecordingEnabled('webapp'), false);
  });
});

function sessionModel() {
  const rows = new Map();
  let seq = 0;
  return {
    rows,
    async create(attrs) {
      const row = { id: ++seq, chunks_received: 0, chunks_uploaded: 0, chunks_failed: 0, ...attrs };
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
  };
}

describe('session gating', () => {
  let model;
  let enabled;

  beforeEach(() => {
    model = sessionModel();
    service.setModel(model);
    service.setChunkModel({ async upsert() {}, async bulkCreate() {}, async update() {} });
    voicedoc.setClient(new voicedoc.MockVoiceDocClient({ delayScale: 0 }));
    enabled = { webapp: true, mobile: true };
    flags.setOverride(async (source) => enabled[source] === true);
  });

  afterEach(() => {
    service.setModel(null);
    service.setChunkModel(null);
    voicedoc.setClient(null);
    flags.setOverride(null);
  });

  const base = { visitUuid: 'v-1', patientUuid: 'p-1', doctorUuid: 'd-1' };

  test('stores the source, defaulting to webapp', async () => {
    const a = await service.createSession(base);
    assert.equal(model.rows.get(a.sessionId).source, 'webapp');
    const b = await service.createSession({ ...base, source: 'mobile' });
    assert.equal(model.rows.get(b.sessionId).source, 'mobile');
    assert.equal(b.source, 'mobile');
  });

  test('rejects an unknown source with 400', async () => {
    await assert.rejects(service.createSession({ ...base, source: 'desktop' }), { status: 400 });
    assert.equal(model.rows.size, 0);
  });

  test('returns 403 VOICEDOC_DISABLED when the source is off', async () => {
    enabled.mobile = false;
    await assert.rejects(service.createSession({ ...base, source: 'mobile' }), {
      status: 403,
      code: 'VOICEDOC_DISABLED',
      message: 'Voice transcription is disabled',
    });
    assert.equal(model.rows.size, 0);
    await service.createSession(base);
  });

  test('a chunk is rejected with 403 once the flag turns off mid-call, and end still works', async () => {
    const { sessionId } = await service.createSession(base);
    await service.enqueueChunk(sessionId, Buffer.from('one'), 1);
    enabled.webapp = false;
    await assert.rejects(service.enqueueChunk(sessionId, Buffer.from('two'), 2), { status: 403, code: 'VOICEDOC_DISABLED' });
    assert.equal(model.rows.get(sessionId).chunks_received, 1);
    const ended = await service.endSession(sessionId);
    assert.equal(ended.status, 'finalizing');
  });

  test('the controller answers 403 with the exact body', async () => {
    enabled.webapp = false;
    const res = fakeRes();
    await controller.createSession({ body: base }, res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { success: false, message: 'Voice transcription is disabled', code: 'VOICEDOC_DISABLED' });
  });
});

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function listModel(rows) {
  const model = {
    calls: [],
    async findAndCountAll(opts) {
      model.calls.push(opts);
      let list = rows.filter((r) => !opts.where.source || r.source === opts.where.source);
      list = [...list].sort((a, b) => (b.started_at - a.started_at) || (b.id - a.id));
      return { count: list.length, rows: list.slice(opts.offset, opts.offset + opts.limit) };
    },
    async findByPk(id) {
      const row = rows.find((r) => r.id === Number(id));
      return row ? { get: () => ({ ...row }) } : null;
    },
  };
  return model;
}

function makeRow(id, overrides = {}) {
  return {
    id,
    visit_id: `visit-${id}`,
    patient_id: 'patient-1',
    doctor_id: 'provider-doc',
    chw_id: 'provider-chw',
    source: 'webapp',
    status: 'done',
    language: 'auto',
    recording_name: `MR-${id}`,
    chunks_received: 2,
    chunks_uploaded: 2,
    chunks_failed: 0,
    started_at: new Date(Date.UTC(2026, 9, 30, 10, 0, id)),
    ended_at: new Date(Date.UTC(2026, 9, 30, 10, 1, id + 30)),
    error: null,
    transcript_preview: `Doctor: hello ${id}`,
    has_summary: 1,
    transcript: `Doctor: hello ${id}`,
    summary: { Diagnosis: 'x' },
    ...overrides,
  };
}

function openmrsStub(handler) {
  const stub = { calls: [] };
  stub.get = async (url) => {
    stub.calls.push(url);
    return { data: await handler(url) };
  };
  return stub;
}

const notFound = () => Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });

const directory = (url) => {
  if (url.startsWith('/openmrs/ws/rest/v1/patient/patient-1?')) {
    return { uuid: 'patient-1', person: { display: 'Asha Rao' }, identifiers: [{ identifier: 'OLD-1', preferred: false }, { identifier: 'IH-1001', preferred: true }] };
  }
  if (url.startsWith('/openmrs/ws/rest/v1/provider/provider-doc?')) return { uuid: 'provider-doc', person: { display: 'Dr Mehta' } };
  if (url.startsWith('/openmrs/ws/rest/v1/provider/provider-chw?')) return { uuid: 'provider-chw', person: { display: 'Nurse Joy' } };
  throw notFound();
};

function chunkListModel(rows) {
  const model = {
    calls: [],
    async findAll(opts) {
      model.calls.push(opts);
      return rows.filter((r) => r.call_transcript_id === opts.where.call_transcript_id).map((r) => ({ get: () => ({ ...r }) }));
    },
  };
  return model;
}

const CHUNK_KEYS = [
  'chunkNumber', 'status', 'attempts', 'bytes', 'durationMs', 'localRms', 'localPeak', 'remoteRms', 'remotePeak',
  'localSources', 'remoteSources', 'response', 'error', 'uploadedAt',
];

describe('admin transcript list and detail', () => {
  let model;
  let chunkModel;

  beforeEach(() => {
    openmrs.clearCaches();
    model = listModel(Array.from({ length: 12 }, (_, i) => makeRow(i + 1, { source: i % 3 === 0 ? 'mobile' : 'webapp' })));
    service.setModel(model);
    chunkModel = chunkListModel([]);
    service.setChunkModel(chunkModel);
    openmrs.setHttp(openmrsStub(directory));
  });

  afterEach(() => {
    service.setModel(null);
    service.setChunkModel(null);
    openmrs.setHttp(null);
    openmrs.clearCaches();
  });

  test('defaults to page 1, limit 10, newest first', async () => {
    const data = await service.listTranscripts({});
    assert.equal(data.total, 12);
    assert.equal(data.page, 1);
    assert.equal(data.limit, 10);
    assert.equal(data.items.length, 10);
    assert.deepEqual(data.items.map((i) => i.id), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    const call = model.calls[0];
    assert.deepEqual(call.order, [['started_at', 'DESC'], ['id', 'DESC']]);
    assert.equal(call.offset, 0);
    assert.equal(call.limit, 10);
    assert.ok(!call.attributes.includes('transcript'));
    assert.ok(!call.attributes.includes('summary'));
    assert.ok(!call.attributes.includes('raw_response'));
    assert.ok(!call.attributes.includes('combined_audio_response'));
    assert.equal(chunkModel.calls.length, 0);
    for (const item of data.items) {
      assert.ok(!('chunks' in item) && !('rawResponse' in item) && !('combinedAudioResponse' in item));
    }
  });

  test('pages through and caps the limit at 50', async () => {
    const second = await service.listTranscripts({ page: '2', limit: '5' });
    assert.deepEqual(second.items.map((i) => i.id), [7, 6, 5, 4, 3]);
    assert.equal(model.calls[0].offset, 5);
    const capped = await service.listTranscripts({ limit: '500' });
    assert.equal(capped.limit, 50);
    assert.equal(model.calls[1].limit, 50);
    assert.equal(capped.items.length, 12);
  });

  test('filters by source', async () => {
    const data = await service.listTranscripts({ source: 'mobile' });
    assert.deepEqual(model.calls[0].where, { source: 'mobile' });
    assert.deepEqual(data.items.map((i) => i.id), [10, 7, 4, 1]);
    assert.ok(data.items.every((i) => i.source === 'mobile'));
  });

  test('rejects bad page, limit and source with 400', async () => {
    for (const q of [{ page: '0' }, { page: 'x' }, { limit: '0' }, { limit: '-3' }, { source: 'desktop' }]) {
      await assert.rejects(service.listTranscripts(q), { status: 400 }, JSON.stringify(q));
    }
    assert.equal(model.calls.length, 0);
  });

  test('items have the documented shape and enriched names, with lookups deduped', async () => {
    const stub = openmrsStub(directory);
    openmrs.setHttp(stub);
    const data = await service.listTranscripts({ limit: '3' });
    assert.deepEqual(Object.keys(data.items[0]).sort(), [...ITEM_KEYS].sort());
    assert.deepEqual(data.items[0], {
      id: 12,
      visitUuid: 'visit-12',
      patientUuid: 'patient-1',
      patientName: 'Asha Rao',
      patientIdentifier: 'IH-1001',
      doctorUuid: 'provider-doc',
      doctorName: 'Dr Mehta',
      chwUuid: 'provider-chw',
      chwName: 'Nurse Joy',
      source: 'webapp',
      status: 'done',
      language: 'auto',
      recordingName: 'MR-12',
      chunksReceived: 2,
      chunksUploaded: 2,
      chunksFailed: 0,
      startedAt: new Date(Date.UTC(2026, 9, 30, 10, 0, 12)),
      endedAt: new Date(Date.UTC(2026, 9, 30, 10, 1, 42)),
      durationSec: 90,
      transcriptPreview: 'Doctor: hello 12',
      hasSummary: true,
      error: null,
    });
    assert.equal(stub.calls.length, 3);
    await service.listTranscripts({ limit: '3' });
    assert.equal(stub.calls.length, 3);
  });

  test('a user uuid falls back to the user resource; unknown uuids become null', async () => {
    model = listModel([makeRow(1, { doctor_id: 'user-doc', chw_id: 'ghost', patient_id: null, transcript_preview: '', has_summary: 0 })]);
    service.setModel(model);
    openmrs.setHttp(openmrsStub((url) => {
      if (url.startsWith('/openmrs/ws/rest/v1/user/user-doc?')) return { uuid: 'user-doc', person: { display: 'Dr User' } };
      throw notFound();
    }));
    const [item] = (await service.listTranscripts({})).items;
    assert.equal(item.doctorName, 'Dr User');
    assert.equal(item.chwName, null);
    assert.equal(item.patientName, null);
    assert.equal(item.transcriptPreview, null);
    assert.equal(item.hasSummary, false);
  });

  test('enrichment failures still return items with null names', async () => {
    openmrs.setHttp({ get: async () => { throw new Error('ECONNRESET'); } });
    const data = await service.listTranscripts({ limit: '2' });
    assert.equal(data.items.length, 2);
    for (const item of data.items) {
      assert.equal(item.patientName, null);
      assert.equal(item.patientIdentifier, null);
      assert.equal(item.doctorName, null);
      assert.equal(item.chwName, null);
    }
  });

  test('detail returns the full transcript and summary', async () => {
    const data = await service.getTranscript('4');
    assert.equal(data.id, 4);
    assert.equal(data.transcript, 'Doctor: hello 4');
    assert.deepEqual(data.summary, { Diagnosis: 'x' });
    assert.equal(data.hasSummary, true);
    assert.equal(data.doctorName, 'Dr Mehta');
    for (const key of ITEM_KEYS) assert.ok(key in data, key);
    assert.equal(data.rawResponse, null);
    assert.equal(data.combinedAudioResponse, null);
    assert.deepEqual(data.chunks, []);
  });

  test('detail adds the raw responses and the chunks sorted by number', async () => {
    const uploadedAt = new Date(Date.UTC(2026, 9, 30, 10, 0, 20));
    const raw = { message: 'End-stream processing successful', transcript: 'Doctor: hello 4', summary: { Diagnosis: [] } };
    model = listModel([makeRow(4, { raw_response: raw, combined_audio_response: '{"message":"Audio Uploaded Successfully"}' })]);
    service.setModel(model);
    chunkModel = chunkListModel([
      { call_transcript_id: 4, chunk_number: 2, status: 'failed', attempts: 5, bytes: 320044, duration_ms: 10000, local_rms: null, local_peak: null, remote_rms: null, remote_peak: null, local_sources: null, remote_sources: null, response: null, error: 'gateway timeout', uploaded_at: null },
      { call_transcript_id: 4, chunk_number: 1, status: 'uploaded', attempts: 1, bytes: 320044, duration_ms: 10000, local_rms: 0.12, local_peak: 0.8, remote_rms: 0.05, remote_peak: 0.4, local_sources: 1, remote_sources: 2, response: { status: 'ok', chunk_number: 1, blob: '' }, error: null, uploaded_at: uploadedAt },
      { call_transcript_id: 9, chunk_number: 1, status: 'uploaded', attempts: 1 },
    ]);
    service.setChunkModel(chunkModel);
    const data = await service.getTranscript('4');
    assert.deepEqual(data.rawResponse, raw);
    assert.deepEqual(data.combinedAudioResponse, { message: 'Audio Uploaded Successfully' });
    assert.deepEqual(chunkModel.calls[0].where, { call_transcript_id: 4 });
    assert.deepEqual(data.chunks.map((c) => c.chunkNumber), [1, 2]);
    for (const chunk of data.chunks) assert.deepEqual(Object.keys(chunk).sort(), [...CHUNK_KEYS].sort());
    assert.deepEqual(data.chunks[0], {
      chunkNumber: 1,
      status: 'uploaded',
      attempts: 1,
      bytes: 320044,
      durationMs: 10000,
      localRms: 0.12,
      localPeak: 0.8,
      remoteRms: 0.05,
      remotePeak: 0.4,
      localSources: 1,
      remoteSources: 2,
      response: { status: 'ok', chunk_number: 1, blob: '' },
      error: null,
      uploadedAt,
    });
    assert.equal(data.chunks[1].error, 'gateway timeout');
    assert.equal(data.chunks[1].localRms, null);
  });

  test('detail still answers when the chunks cannot be loaded', async () => {
    service.setChunkModel({ async findAll() { throw new Error('ER_NO_SUCH_TABLE'); } });
    const data = await service.getTranscript('4');
    assert.equal(data.id, 4);
    assert.deepEqual(data.chunks, []);
  });

  test('detail answers 404 for a missing or malformed id', async () => {
    for (const id of ['999', 'abc', '1; drop']) {
      const res = fakeRes();
      await controller.getTranscript({ params: { id } }, res);
      assert.equal(res.statusCode, 404, id);
      assert.deepEqual(res.body, { success: false, message: 'Transcript not found.' });
    }
  });

  test('the list controller wraps data in success', async () => {
    const res = fakeRes();
    await controller.listTranscripts({ query: { limit: '1' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(Object.keys(res.body.data).sort(), ['items', 'limit', 'page', 'total']);
  });
});

describe('requireAdmin', () => {
  beforeEach(() => openmrs.clearCaches());

  afterEach(() => {
    openmrs.setHttp(null);
    openmrs.clearCaches();
  });

  const run = async (userId) => {
    const res = fakeRes();
    let nextCalled = false;
    await controller.requireAdmin({ user: { data: { userId } } }, res, () => { nextCalled = true; });
    return { res, nextCalled };
  };

  const rolesFor = (roles) => openmrsStub(() => ({ uuid: 'u', roles }));

  test('lets a System Administrator through, case-insensitively, and caches the answer', async () => {
    const stub = rolesFor([{ name: 'Provider', display: 'Provider' }, { name: 'x', display: 'organizational: SYSTEM administrator' }]);
    openmrs.setHttp(stub);
    assert.equal((await run('admin-1')).nextCalled, true);
    assert.equal((await run('admin-1')).nextCalled, true);
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0], '/openmrs/ws/rest/v1/user/admin-1?v=custom:(uuid,roles:(name,display))');
  });

  test('403 for a non-admin', async () => {
    openmrs.setHttp(rolesFor([{ name: 'Organizational: Doctor', display: 'Organizational: Doctor' }]));
    const { res, nextCalled } = await run('doc-1');
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { success: false, message: 'Admin access required' });
  });

  test('403 when the role lookup fails, and the failure is not cached', async () => {
    let fail = true;
    openmrs.setHttp(openmrsStub(() => {
      if (fail) throw new Error('ECONNREFUSED');
      return { roles: [{ name: 'Organizational: System Administrator' }] };
    }));
    const first = await run('admin-2');
    assert.equal(first.nextCalled, false);
    assert.equal(first.res.statusCode, 403);
    assert.deepEqual(first.res.body, { success: false, message: 'Admin access required' });
    fail = false;
    assert.equal((await run('admin-2')).nextCalled, true);
  });

  test('403 when the token carries no userId', async () => {
    openmrs.setHttp(rolesFor([{ name: 'Organizational: System Administrator' }]));
    const { res } = await run(undefined);
    assert.equal(res.statusCode, 403);
  });
});
