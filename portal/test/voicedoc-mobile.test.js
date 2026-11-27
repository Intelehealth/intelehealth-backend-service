'use strict';
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.VOICEDOC_MOCK = 'true';
process.env.CONFIG_SERVICE_URL = 'http://config.test/api/';

const flags = require('../services/voicedoc/flags');
const openmrs = require('../services/voicedoc/openmrs');
const service = require('../services/voicedoc.service');
const controller = require('../controllers/voicedoc.controller');

const VISIT_NOTE = 'd7151f82-c1f3-4152-a605-2f9ea7414a79';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function model() {
  const rows = new Map();
  let seq = 0;
  const matches = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    rows,
    async create(attrs) {
      const row = { id: ++seq, ...attrs };
      rows.set(row.id, row);
      return { ...row };
    },
    async findOne({ where }) {
      const row = [...rows.values()].find((r) => matches(r, where));
      return row ? { ...row } : null;
    },
    async findByPk(id) {
      const row = rows.get(Number(id));
      return row ? { ...row } : null;
    },
    async update(values, { where }) {
      Object.assign(rows.get(Number(where.id)), values);
    },
    async findAll() {
      return [...rows.values()];
    },
    async findAndCountAll(opts) {
      const list = [...rows.values()].filter((r) => !opts.where.source || r.source === opts.where.source);
      return { count: list.length, rows: list.slice(opts.offset, opts.offset + opts.limit) };
    },
  };
}

function chunkModel() {
  const rows = new Map();
  return {
    rows,
    async upsert(values) {
      const key = `${values.call_transcript_id}:${values.chunk_number}`;
      rows.set(key, { ...rows.get(key), ...values });
    },
    async findAll({ where }) {
      return [...rows.values()].filter((r) => r.call_transcript_id === where.call_transcript_id);
    },
  };
}

const valid = () => ({
  visitUuid: 'visit-1',
  patientUuid: 'patient-1',
  doctorUuid: 'doctor-1',
  chunkId: 'chunk-abc',
  recordingName: 'rec-1',
  jatayuAccount: 'doc@intelehealth.org',
  status: 'done',
  startedAt: '2026-11-01T10:00:00.000Z',
  endedAt: '2026-11-01T10:05:00.000Z',
  chunksReceived: 2,
  chunksUploaded: 2,
  transcript: 'hello doctor',
  summary: '{"complaint":"fever"}',
});

const call = async (body) => {
  const res = fakeRes();
  await controller.saveMobileTranscript({ body }, res);
  return res;
};

describe('saveMobileTranscript', () => {
  let rows;
  let chunks;
  let enabled;

  beforeEach(() => {
    rows = model();
    chunks = chunkModel();
    service.setModel(rows);
    service.setChunkModel(chunks);
    enabled = { webapp: true, mobile: true };
    flags.setOverride(async (source) => enabled[source] === true);
    flags.setNoteOverride(async () => false);
  });

  afterEach(() => {
    service.setModel(null);
    service.setChunkModel(null);
    flags.setOverride(null);
    flags.setNoteOverride(async () => false);
    openmrs.setHttp(null);
  });

  test('creates a mobile row with 201', async () => {
    const res = await call(valid());
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { success: true, data: { id: 1, created: true, noteStatus: null } });
    const row = rows.rows.get(1);
    assert.equal(row.source, 'mobile');
    assert.equal(row.chunk_id, 'chunk-abc');
    assert.equal(row.voicedoc_account, 'doc@intelehealth.org');
    assert.deepEqual(row.summary, { complaint: 'fever' });
    assert.equal(row.chunks_uploaded, 2);
    assert.equal(row.chunks_failed, 0);
    assert.ok(row.language);
  });

  test('updates the same chunkId with 200 and keeps absent fields', async () => {
    await call(valid());
    const { transcript, summary, ...rest } = valid();
    const res = await call({ ...rest, status: 'error', error: 'boom' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, { id: 1, created: false, noteStatus: null });
    assert.equal(rows.rows.size, 1);
    const row = rows.rows.get(1);
    assert.equal(row.status, 'error');
    assert.equal(row.error, 'boom');
    assert.equal(row.transcript, 'hello doctor');
    assert.deepEqual(row.summary, { complaint: 'fever' });
  });

  test('409 when the chunkId belongs to a webapp recording', async () => {
    await rows.create({ source: 'webapp', chunk_id: 'chunk-abc' });
    const res = await call(valid());
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'chunkId already belongs to a non-mobile recording');
    assert.equal(rows.rows.size, 1);
  });

  describe('validation', () => {
    const cases = [
      ['missing visitUuid', (b) => { delete b.visitUuid; }],
      ['missing patientUuid', (b) => { delete b.patientUuid; }],
      ['missing chunkId', (b) => { delete b.chunkId; }],
      ['missing recordingName', (b) => { delete b.recordingName; }],
      ['bad status', (b) => { b.status = 'recording'; }],
      ['done without transcript', (b) => { delete b.transcript; }],
      ['done with blank transcript', (b) => { b.transcript = '  '; }],
      ['bad startedAt', (b) => { b.startedAt = 'yesterday'; }],
      ['bad endedAt', (b) => { b.endedAt = '2026-13-45T00:00:00Z'; }],
      ['endedAt before startedAt', (b) => { b.endedAt = '2026-10-01T00:00:00Z'; }],
      ['negative count', (b) => { b.chunksFailed = -1; }],
      ['bad chunkNumber', (b) => { b.chunks = [{ chunkNumber: 0, status: 'uploaded' }]; }],
      ['bad chunk status', (b) => { b.chunks = [{ chunkNumber: 1, status: 'weird' }]; }],
      ['array summary', (b) => { b.summary = [1]; }],
    ];
    for (const [name, mutate] of cases) {
      test(`400 for ${name}`, async () => {
        const body = valid();
        mutate(body);
        const res = await call(body);
        assert.equal(res.statusCode, 400, name);
        assert.equal(res.body.success, false);
        assert.ok(res.body.message);
        assert.equal(rows.rows.size, 0);
      });
    }
  });

  test('403 when the mobile flag is off', async () => {
    enabled.mobile = false;
    const res = await call(valid());
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'VOICEDOC_DISABLED');
    assert.equal(rows.rows.size, 0);
  });

  test('upserts chunks by transcript and chunk number', async () => {
    const body = {
      ...valid(),
      chunks: [
        { chunkNumber: 1, status: 'uploaded', attempts: 1, bytes: 100, durationMs: 5000, response: { ok: true } },
        { chunkNumber: 2, status: 'failed', attempts: 3, error: 'timeout' },
      ],
    };
    await call(body);
    await call({ ...body, chunks: [{ chunkNumber: 2, status: 'uploaded', attempts: 4 }] });
    assert.equal(chunks.rows.size, 2);
    const one = chunks.rows.get('1:1');
    assert.equal(one.bytes, 100);
    assert.equal(one.duration_ms, 5000);
    assert.deepEqual(one.response, { ok: true });
    assert.ok(one.uploaded_at);
    const two = chunks.rows.get('1:2');
    assert.equal(two.status, 'uploaded');
    assert.equal(two.attempts, 4);
  });

  const noteHttp = (encounters, posts) => ({
    async get(url) {
      if (url.includes('/visit/')) return { data: { uuid: 'visit-1', encounters } };
      throw Object.assign(new Error('nf'), { response: { status: 404 } });
    },
    async post(url, payload) {
      posts.push([url, payload]);
      return { data: { uuid: 'obs-1' } };
    },
  });

  test('noteStatus is disabled when autofill is off', async () => {
    const res = await call({ ...valid(), visitSummary: 'Overall summary' });
    assert.equal(res.body.data.noteStatus, 'disabled');
    assert.equal(rows.rows.get(1).visit_summary, 'Overall summary');
    assert.ok(rows.rows.get(1).visit_summary_at);
  });

  test('saves the doctor note when autofill is on', async () => {
    const posts = [];
    flags.setNoteOverride(async () => true);
    openmrs.setHttp(noteHttp([{ uuid: 'enc-1', encounterType: { uuid: VISIT_NOTE } }], posts));
    const res = await call({ ...valid(), visitSummary: 'Overall summary' });
    assert.equal(res.body.data.noteStatus, 'saved');
    assert.equal(posts.length, 1);
    assert.equal(rows.rows.get(1).note_obs_uuid, 'obs-1');
  });

  test('noteStatus no_encounter when the visit has no visit note', async () => {
    flags.setNoteOverride(async () => true);
    openmrs.setHttp(noteHttp([], []));
    const res = await call({ ...valid(), visitSummary: 'Overall summary' });
    assert.equal(res.body.data.noteStatus, 'no_encounter');
  });

  test('a saveNote failure does not fail the request', async () => {
    flags.setNoteOverride(async () => { throw new Error('flags down'); });
    const res = await call({ ...valid(), visitSummary: 'Overall summary' });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.noteStatus, null);
  });

  test('no note attempt without a visit summary or when not done', async () => {
    flags.setNoteOverride(async () => true);
    openmrs.setHttp(noteHttp([], []));
    assert.equal((await call(valid())).body.data.noteStatus, null);
    const { transcript, ...rest } = valid();
    const res = await call({ ...rest, chunkId: 'other', status: 'empty', visitSummary: 'x' });
    assert.equal(res.body.data.noteStatus, null);
  });

  test('listTranscripts returns the saved row as mobile', async () => {
    await call({ ...valid(), chunks: [{ chunkNumber: 1, status: 'uploaded' }] });
    openmrs.setHttp({ async get() { throw new Error('offline'); } });
    const list = await service.listTranscripts({ source: 'mobile' });
    assert.equal(list.total, 1);
    assert.equal(list.items[0].source, 'mobile');
    assert.equal(list.items[0].recordingName, 'rec-1');
    assert.equal(list.items[0].durationSec, 300);
    const other = await service.listTranscripts({ source: 'webapp' });
    assert.equal(other.total, 0);
  });

  test('getTranscript renders chunks, account and visit summary', async () => {
    await call({ ...valid(), visitSummary: 'Overall summary', chunks: [{ chunkNumber: 1, status: 'uploaded', bytes: 9 }] });
    openmrs.setHttp({ async get() { throw new Error('offline'); } });
    const detail = await service.getTranscript(1);
    assert.equal(detail.source, 'mobile');
    assert.equal(detail.voicedocAccount, 'doc@intelehealth.org');
    assert.equal(detail.visitSummary, 'Overall summary');
    assert.equal(detail.chunks.length, 1);
    assert.equal(detail.chunks[0].chunkNumber, 1);
    assert.equal(detail.chunks[0].bytes, 9);
    assert.deepEqual(detail.summary, { complaint: 'fever' });
  });
});
