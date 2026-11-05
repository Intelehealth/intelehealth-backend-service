'use strict';
const crypto = require('crypto');
const { fn, col, literal } = require('sequelize');
const voicedoc = require('./voicedoc');
const flags = require('./voicedoc/flags');
const openmrs = require('./voicedoc/openmrs');
const { logStream } = require('../logger/index');

let modelOverride = null;
let chunkModelOverride = null;
const pending = new Map();

function getModel() {
  if (modelOverride) {
    return modelOverride;
  }
  return require('../models').call_transcript;
}

function setModel(model) {
  modelOverride = model;
}

function getChunkModel() {
  if (chunkModelOverride) {
    return chunkModelOverride;
  }
  return require('../models').call_transcript_chunk;
}

function setChunkModel(model) {
  chunkModelOverride = model;
}

const PREVIEW_CHARS = 160;
const MAX_LIMIT = 50;
const DISABLED_MESSAGE = 'Voice transcription is disabled';

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) {
    err.code = code;
  }
  return err;
}

function normaliseSource(source) {
  if (source === undefined || source === null) {
    return 'webapp';
  }
  const value = String(source).trim().toLowerCase();
  if (!flags.SOURCES.includes(value)) {
    throw httpError(400, `source must be one of: ${flags.SOURCES.join(', ')}.`);
  }
  return value;
}

async function assertEnabled(source) {
  if (!(await flags.isRecordingEnabled(source))) {
    throw httpError(403, DISABLED_MESSAGE, 'VOICEDOC_DISABLED');
  }
}

function pendingFor(sessionId) {
  const key = String(sessionId);
  if (!pending.has(key)) {
    pending.set(key, new Set());
  }
  return pending.get(key);
}

function pendingCount(sessionId) {
  const set = pending.get(String(sessionId));
  return set ? set.size : 0;
}

function track(sessionId, promise) {
  const set = pendingFor(sessionId);
  set.add(promise);
  promise.finally(() => {
    set.delete(promise);
    if (!set.size) {
      pending.delete(String(sessionId));
    }
  });
}

const LEVEL_FIELDS = [
  ['localRms', 'local_rms'],
  ['localPeak', 'local_peak'],
  ['remoteRms', 'remote_rms'],
  ['remotePeak', 'remote_peak'],
];
const SOURCE_FIELDS = [
  ['localSources', 'local_sources'],
  ['remoteSources', 'remote_sources'],
];
const MAX_INT = 2147483647;

function numericInput(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

function parseChunkMeta(body) {
  const meta = {};
  const input = body && typeof body === 'object' ? body : {};
  for (const [field, column] of LEVEL_FIELDS) {
    const n = numericInput(input[field]);
    meta[column] = n === null ? null : Math.min(1, Math.max(0, n));
  }
  for (const [field, column] of SOURCE_FIELDS) {
    const n = numericInput(input[field]);
    meta[column] = n === null ? null : Math.min(MAX_INT, Math.max(0, Math.round(n)));
  }
  return meta;
}

function wavDurationMs(buffer) {
  if (!buffer || !buffer.length) {
    return 0;
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    let byteRate = 0;
    let offset = 12;
    while (offset + 8 <= buffer.length) {
      const id = buffer.toString('ascii', offset, offset + 4);
      const size = buffer.readUInt32LE(offset + 4);
      if (id === 'fmt ' && offset + 16 <= buffer.length) {
        byteRate = buffer.readUInt32LE(offset + 16);
      } else if (id === 'data') {
        const dataBytes = Math.min(size, buffer.length - offset - 8);
        if (byteRate > 0) {
          return Math.round((dataBytes * 1000) / byteRate);
        }
        break;
      }
      offset += 8 + size + (size % 2);
    }
  }
  return Math.max(0, Math.round((buffer.length - 44) / 32));
}

function jsonColumn(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  return { raw: typeof value === 'string' ? value : JSON.stringify(value) };
}

function errorColumn(err) {
  const value = { error: err.message, status: err.status ?? null };
  if (err.body !== undefined && err.body !== null) {
    value.body = jsonColumn(err.body);
  }
  return value;
}

async function chunkWrite(sessionId, chunkNumber, write) {
  try {
    await write(getChunkModel());
  } catch (err) {
    logStream('error', `VoiceDoc chunk ${chunkNumber} of session ${sessionId} tracking failed: ${err.message}`, 'VoiceDoc');
  }
}

function chunkUpdate(sessionId, chunkNumber, values) {
  return chunkWrite(sessionId, chunkNumber, (ChunkModel) => ChunkModel.update(values, {
    where: { call_transcript_id: sessionId, chunk_number: chunkNumber },
  }));
}

async function sessionAccount(userId) {
  try {
    return await voicedoc.resolveAccount(userId);
  } catch (err) {
    logStream('error', `VoiceDoc login as ${err.account} failed, using the shared account: ${err.message}`, 'VoiceDoc');
    return null;
  }
}

async function createSession({ visitUuid, patientUuid, doctorUuid, chwUuid, roomId, language, source, userId }) {
  const origin = normaliseSource(source);
  await assertEnabled(origin);
  const cfg = voicedoc.getConfig();
  const account = await sessionAccount(userId);
  const chunkId = crypto.randomBytes(16).toString('hex');
  const name = voicedoc.buildRecordingName(patientUuid, visitUuid, cfg.timeZone);
  const row = await getModel().create({
    visit_id: visitUuid,
    patient_id: patientUuid || null,
    doctor_id: doctorUuid || null,
    chw_id: chwUuid || null,
    room_id: roomId || null,
    source: origin,
    chunk_id: chunkId,
    recording_name: name,
    language: language || cfg.language,
    voicedoc_account: account,
    status: 'recording',
    started_at: new Date(),
  });
  return { sessionId: row.id, chunkId, name, source: origin };
}

async function uploadJob(row, buffer, chunkNumber, onAttempt = () => {}) {
  const cfg = voicedoc.getConfig();
  const client = voicedoc.getClient(row.voicedoc_account);
  const encrypt = cfg.encryptAudio;
  if (encrypt && typeof client.prepare === 'function') {
    await voicedoc.withRetry(() => client.prepare({ encrypt }));
  }
  return voicedoc.withRetry(() => {
    onAttempt();
    return client.uploadChunk({
      wav: buffer,
      chunkId: row.chunk_id,
      chunkNumber,
      name: row.recording_name,
      language: row.language || cfg.language,
      encrypt,
    });
  });
}

async function enqueueChunk(sessionId, buffer, chunkNumber, meta = {}) {
  const Model = getModel();
  const row = await Model.findByPk(sessionId);
  if (!row) {
    throw httpError(404, 'Transcription session not found.');
  }
  const info = {
    call_transcript_id: row.id,
    chunk_number: chunkNumber,
    bytes: buffer.length,
    duration_ms: wavDurationMs(buffer),
    ...parseChunkMeta(meta),
  };
  try {
    if (row.status !== 'recording') {
      throw httpError(409, `Transcription session is ${row.status}.`);
    }
    await assertEnabled(row.source || 'webapp');
    if (pendingCount(row.id) >= voicedoc.getConfig().maxPendingChunks) {
      throw httpError(429, 'Too many chunks are waiting to upload for this session.');
    }
  } catch (err) {
    await chunkWrite(row.id, chunkNumber, (ChunkModel) => ChunkModel.bulkCreate(
      [{ ...info, status: 'skipped', attempts: 0, error: err.message }],
      { ignoreDuplicates: true }
    ));
    throw err;
  }

  await chunkWrite(row.id, chunkNumber, (ChunkModel) => ChunkModel.upsert({
    ...info,
    status: 'queued',
    attempts: 0,
    response: null,
    error: null,
    uploaded_at: null,
  }));

  const where = { where: { id: row.id } };
  let attempts = 0;
  const received = Model.increment('chunks_received', where);
  const job = received
    .then(() => voicedoc.runInLane(() => uploadJob(row, buffer, chunkNumber, () => { attempts++; }), row.voicedoc_account))
    .then(
      (response) => Promise.all([
        Model.increment('chunks_uploaded', where),
        chunkUpdate(row.id, chunkNumber, {
          status: 'uploaded',
          attempts,
          response: jsonColumn(response),
          error: null,
          uploaded_at: new Date(),
        }),
      ]),
      (err) => {
        logStream('error', `VoiceDoc chunk ${chunkNumber} of session ${row.id} failed: ${err.message}`, 'VoiceDoc');
        return Promise.all([
          Model.increment('chunks_failed', where),
          chunkUpdate(row.id, chunkNumber, {
            status: 'failed',
            attempts,
            response: err.body !== undefined ? jsonColumn(err.body) : null,
            error: err.message,
          }),
        ]);
      }
    )
    .catch((err) => {
      logStream('error', `VoiceDoc chunk ${chunkNumber} of session ${row.id} bookkeeping failed: ${err.message}`, 'VoiceDoc');
    });
  track(row.id, job);
  await received;
  return { chunkNumber, queued: pendingCount(row.id) };
}

async function finalize(sessionId) {
  const Model = getModel();
  const where = { where: { id: sessionId } };
  try {
    let set = pending.get(String(sessionId));
    while (set && set.size) {
      await Promise.allSettled([...set]);
      set = pending.get(String(sessionId));
    }
    const row = await Model.findByPk(sessionId);
    if (!row) {
      return;
    }
    await chunkWrite(row.id, 'queue', (ChunkModel) => ChunkModel.update(
      { status: 'skipped', error: 'Not uploaded before the session ended.' },
      { where: { call_transcript_id: row.id, status: 'queued' } }
    ));
    if (!row.chunks_uploaded) {
      await Model.update({ status: 'empty', error: 'no chunks uploaded' }, where);
      return;
    }

    const client = voicedoc.getClient(row.voicedoc_account);
    const language = row.language || voicedoc.getConfig().language;
    let response;
    try {
      response = await voicedoc.runInLane(() => client.endStream({
        chunkId: row.chunk_id,
        name: row.recording_name,
        fields: voicedoc.DEFAULT_FIELDS,
        language,
      }), row.voicedoc_account);
    } catch (err) {
      if (err.body !== undefined && err.body !== null) {
        err.rawResponse = jsonColumn(err.body);
      }
      throw err;
    }
    const transcript = typeof response?.transcript === 'string' ? response.transcript : '';
    const summary = voicedoc.parseSummary(response?.summary);
    const empty = !transcript.trim() || summary?.status === 'Audio is Empty';
    await Model.update({ status: empty ? 'empty' : 'done', transcript, summary, raw_response: jsonColumn(response) }, where);
    if (empty) {
      return;
    }

    try {
      const audio = await voicedoc.runInLane(() => client.uploadCombinedAudio({ chunkId: row.chunk_id, name: row.recording_name }), row.voicedoc_account);
      await Model.update({ combined_audio_response: jsonColumn(audio) }, where);
    } catch (err) {
      logStream('error', `VoiceDoc combined audio for session ${sessionId} failed: ${err.message}`, 'VoiceDoc');
      const message = `Combined audio was not saved: ${err.message}`;
      await Model.update({ error: row.error ? `${row.error}\n${message}` : message, combined_audio_response: errorColumn(err) }, where);
    }
    await generateVisitSummary(plain(await Model.findByPk(sessionId))).catch((err) => {
      logStream('error', `VoiceDoc visit summary of session ${sessionId} failed: ${err.message}`, 'VoiceDoc');
    });
  } catch (err) {
    logStream('error', `VoiceDoc finalize of session ${sessionId} failed: ${err.message}`, 'VoiceDoc');
    const values = { status: 'error', error: err.message };
    if (err.rawResponse !== undefined) {
      values.raw_response = err.rawResponse;
    }
    await Model.update(values, where).catch(() => {});
  }
}

async function endSession(sessionId) {
  const Model = getModel();
  const row = await Model.findByPk(sessionId);
  if (!row) {
    throw httpError(404, 'Transcription session not found.');
  }
  if (row.status !== 'recording') {
    return { sessionId: row.id, status: row.status, alreadyEnded: true };
  }
  await Model.update({ status: 'finalizing', ended_at: new Date() }, { where: { id: row.id } });
  finalize(row.id).catch((err) => {
    logStream('error', `VoiceDoc finalize of session ${row.id} crashed: ${err.message}`, 'VoiceDoc');
  });
  return { sessionId: row.id, status: 'finalizing' };
}

async function getByVisit(visitUuid) {
  return getModel().findAll({
    where: { visit_id: visitUuid },
    attributes: { exclude: ['raw_response', 'combined_audio_response'] },
    order: [['started_at', 'DESC']],
  });
}

const LIST_ATTRIBUTES = [
  'id', 'visit_id', 'patient_id', 'doctor_id', 'chw_id', 'source', 'status', 'language', 'recording_name',
  'chunks_received', 'chunks_uploaded', 'chunks_failed', 'started_at', 'ended_at', 'error',
  [fn('LEFT', col('transcript'), PREVIEW_CHARS), 'transcript_preview'],
  [literal('(`summary` IS NOT NULL)'), 'has_summary'],
];

function plain(row) {
  return row && typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

function durationSec(start, end) {
  if (!start || !end) {
    return null;
  }
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : null;
}

function preview(text) {
  return typeof text === 'string' && text.length ? text.slice(0, PREVIEW_CHARS) : null;
}

function toItem(row, names) {
  const patient = (row.patient_id && names.patients.get(row.patient_id)) || null;
  return {
    id: row.id,
    visitUuid: row.visit_id,
    patientUuid: row.patient_id || null,
    patientName: patient ? patient.name : null,
    patientIdentifier: patient ? patient.identifier : null,
    doctorUuid: row.doctor_id || null,
    doctorName: (row.doctor_id && names.people.get(row.doctor_id)) || null,
    chwUuid: row.chw_id || null,
    chwName: (row.chw_id && names.people.get(row.chw_id)) || null,
    source: row.source || 'webapp',
    status: row.status,
    language: row.language || null,
    recordingName: row.recording_name || null,
    chunksReceived: row.chunks_received,
    chunksUploaded: row.chunks_uploaded,
    chunksFailed: row.chunks_failed,
    startedAt: row.started_at || null,
    endedAt: row.ended_at || null,
    durationSec: durationSec(row.started_at, row.ended_at),
    transcriptPreview: preview(row.transcript_preview),
    hasSummary: Boolean(Number(row.has_summary)),
    error: row.error || null,
  };
}

async function safeNames(rows) {
  try {
    return await openmrs.resolveNames(rows);
  } catch (err) {
    logStream('error', `VoiceDoc name enrichment failed: ${err.message}`, 'VoiceDoc');
    return { patients: new Map(), people: new Map() };
  }
}

function parseListQuery(query = {}) {
  const int = (value, fallback, name) => {
    if (value === undefined || value === '') {
      return fallback;
    }
    const raw = String(value);
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(n) || n < 1) {
      throw httpError(400, `${name} must be an integer of 1 or more.`);
    }
    return n;
  };
  const page = int(query.page, 1, 'page');
  const limit = Math.min(int(query.limit, 10, 'limit'), MAX_LIMIT);
  let source = null;
  if (query.source !== undefined && query.source !== '') {
    source = String(query.source).trim().toLowerCase();
    if (!flags.SOURCES.includes(source)) {
      throw httpError(400, `source must be one of: ${flags.SOURCES.join(', ')}.`);
    }
  }
  return { page, limit, source };
}

async function listTranscripts(query) {
  const { page, limit, source } = parseListQuery(query);
  const { rows, count } = await getModel().findAndCountAll({
    where: source ? { source } : {},
    attributes: LIST_ATTRIBUTES,
    order: [['started_at', 'DESC'], ['id', 'DESC']],
    offset: (page - 1) * limit,
    limit,
  });
  const items = rows.map(plain);
  const names = await safeNames(items);
  return { items: items.map((row) => toItem(row, names)), total: count, page, limit };
}

function parseStoredSummary(summary) {
  if (typeof summary !== 'string') {
    return summary ?? null;
  }
  try {
    return JSON.parse(summary);
  } catch {
    return summary;
  }
}

function parseStoredJson(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

function numberOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toChunk(row) {
  return {
    chunkNumber: Number(row.chunk_number),
    status: row.status,
    attempts: Number(row.attempts) || 0,
    bytes: numberOrNull(row.bytes),
    durationMs: numberOrNull(row.duration_ms),
    localRms: numberOrNull(row.local_rms),
    localPeak: numberOrNull(row.local_peak),
    remoteRms: numberOrNull(row.remote_rms),
    remotePeak: numberOrNull(row.remote_peak),
    localSources: numberOrNull(row.local_sources),
    remoteSources: numberOrNull(row.remote_sources),
    response: parseStoredJson(row.response),
    error: row.error || null,
    uploadedAt: row.uploaded_at || null,
  };
}

async function loadChunks(transcriptId) {
  try {
    const rows = await getChunkModel().findAll({
      where: { call_transcript_id: transcriptId },
      order: [['chunk_number', 'ASC']],
    });
    return rows.map(plain).map(toChunk).sort((a, b) => a.chunkNumber - b.chunkNumber);
  } catch (err) {
    logStream('error', `VoiceDoc chunks of transcript ${transcriptId} failed to load: ${err.message}`, 'VoiceDoc');
    return [];
  }
}

async function getTranscript(id) {
  const raw = String(id ?? '');
  if (!/^\d+$/.test(raw)) {
    throw httpError(404, 'Transcript not found.');
  }
  const row = plain(await getModel().findByPk(raw));
  if (!row) {
    throw httpError(404, 'Transcript not found.');
  }
  const summary = parseStoredSummary(row.summary);
  const [names, chunks] = await Promise.all([safeNames([row]), loadChunks(row.id)]);
  const item = toItem({ ...row, transcript_preview: row.transcript, has_summary: summary !== null }, names);
  return {
    ...item,
    transcript: row.transcript ?? null,
    summary,
    rawResponse: parseStoredJson(row.raw_response),
    combinedAudioResponse: parseStoredJson(row.combined_audio_response),
    voicedocAccount: row.voicedoc_account || null,
    visitSummary: row.visit_summary ?? null,
    visitSummaryResponse: parseStoredJson(row.visit_summary_response),
    visitSummaryAt: row.visit_summary_at || null,
    noteObsUuid: row.note_obs_uuid || null,
    noteStatus: row.note_status || null,
    noteError: row.note_error || null,
    chunks,
  };
}

async function previousNoteObs(row) {
  const rows = await getModel().findAll({
    where: { visit_id: row.visit_id },
    attributes: ['id', 'note_obs_uuid'],
    order: [['id', 'DESC']],
  });
  const prior = rows.map(plain)
    .filter((r) => r.id !== row.id && r.note_obs_uuid)
    .sort((a, b) => b.id - a.id)[0];
  return prior ? prior.note_obs_uuid : null;
}

async function saveNote(row, summary) {
  const where = { where: { id: row.id } };
  if (!(await flags.isNoteAutofillEnabled())) {
    await getModel().update({ note_status: 'disabled', note_error: null }, where);
    return;
  }
  try {
    const encounterUuid = await openmrs.findVisitNoteEncounter(row.visit_id);
    if (!encounterUuid) {
      await getModel().update({ note_status: 'no_encounter', note_error: 'The visit has no visit note encounter yet.' }, where);
      return;
    }
    const obsUuid = row.note_obs_uuid || await previousNoteObs(row);
    const saved = await openmrs.upsertNote({ patientUuid: row.patient_id, encounterUuid, value: summary, obsUuid });
    await getModel().update({ note_obs_uuid: saved.uuid || null, note_status: saved.updated ? 'updated' : 'saved', note_error: null }, where);
  } catch (err) {
    const detail = err.response && err.response.data ? JSON.stringify(err.response.data).slice(0, 500) : err.message;
    logStream('error', `VoiceDoc doctor note for transcript ${row.id} failed: ${detail}`, 'VoiceDoc');
    await getModel().update({ note_status: 'error', note_error: detail }, where);
  }
}

async function generateVisitSummary(row) {
  const where = { where: { id: row.id } };
  const name = voicedoc.visitSummaryName(row.recording_name);
  if (!name) {
    return null;
  }
  const client = voicedoc.getClient(row.voicedoc_account);
  let response;
  try {
    response = await voicedoc.runInLane(() => voicedoc.withRetry(async () => {
      await client.prepare({ encrypt: false });
      return client.patientVisitSummary(name);
    }, 3), row.voicedoc_account);
  } catch (err) {
    logStream('error', `VoiceDoc visit summary for ${name} failed: ${err.message}`, 'VoiceDoc');
    await getModel().update({ visit_summary_response: errorColumn(err), visit_summary_at: new Date() }, where);
    return null;
  }
  const summary = String((response && response.overall_summary) || '').trim();
  await getModel().update({ visit_summary: summary || null, visit_summary_response: jsonColumn(response), visit_summary_at: new Date() }, where);
  if (summary) {
    await saveNote(row, summary);
  }
  return summary;
}

async function regenerateVisitSummary(id) {
  const raw = String(id ?? '');
  if (!/^\d+$/.test(raw)) {
    throw httpError(404, 'Transcript not found.');
  }
  const row = plain(await getModel().findByPk(raw));
  if (!row || !voicedoc.visitSummaryName(row.recording_name)) {
    throw httpError(404, 'Transcript not found.');
  }
  if (row.status !== 'done') {
    throw httpError(409, 'The visit summary is available once the transcript is done.');
  }
  const summary = await generateVisitSummary(row);
  if (summary === null) {
    throw httpError(502, 'VoiceDoc visit summary is unavailable. Try again later.', 'VOICEDOC_VISIT_SUMMARY_FAILED');
  }
  return getTranscript(raw);
}

module.exports = {
  getModel,
  setModel,
  getChunkModel,
  setChunkModel,
  parseChunkMeta,
  wavDurationMs,
  jsonColumn,
  createSession,
  enqueueChunk,
  endSession,
  finalize,
  getByVisit,
  parseListQuery,
  listTranscripts,
  getTranscript,
  generateVisitSummary,
  regenerateVisitSummary,
};
