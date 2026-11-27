'use strict';
const multer = require('multer');
const voicedocService = require('../services/voicedoc.service');
const openmrs = require('../services/voicedoc/openmrs');
const { logStream } = require('../logger/index');

const MAX_CHUNK_BYTES = 2 * 1024 * 1024;

const MESSAGES = {
  missingFields: 'visitUuid, patientUuid and doctorUuid are required.',
  missingFile: 'An audio chunk is required in the "file" field.',
  invalidChunkNumber: 'chunkNumber must be an integer of 1 or more.',
  adminRequired: 'Admin access required',
  unexpected: 'Something went wrong with the call transcription. Please try again, and contact support if this keeps happening.',
};

const parseChunk = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CHUNK_BYTES } }).single('file');

function sendError(res, err, context) {
  const status = err.status || 500;
  if (status >= 500) {
    logStream('error', `${context} failed: ${err.message}`, 'VoiceDoc');
  }
  if (status >= 500) {
    return res.status(status).json({ success: false, message: MESSAGES.unexpected });
  }
  const body = { success: false, message: err.message };
  if (err.code) {
    body.code = err.code;
  }
  return res.status(status).json(body);
}

const createSession = async (req, res) => {
  const { visitUuid, patientUuid, doctorUuid, chwUuid, roomId, language, source } = req.body || {};
  if (!visitUuid || !patientUuid || !doctorUuid) {
    return res.status(400).json({ success: false, message: MESSAGES.missingFields });
  }
  try {
    const userId = req.user && req.user.data && req.user.data.userId;
    const data = await voicedocService.createSession({ visitUuid, patientUuid, doctorUuid, chwUuid, roomId, language, source, userId });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err, '/voicedoc/sessions');
  }
};

const uploadChunk = (req, res) => {
  parseChunk(req, res, async (multerErr) => {
    if (multerErr) {
      return res.status(400).json({ success: false, message: multerErr.message });
    }
    const { id } = req.params;
    const raw = String((req.body && req.body.chunkNumber) ?? '');
    const chunkNumber = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(chunkNumber) || chunkNumber < 1) {
      return res.status(400).json({ success: false, message: MESSAGES.invalidChunkNumber });
    }
    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({ success: false, message: MESSAGES.missingFile });
    }
    try {
      const data = await voicedocService.enqueueChunk(id, req.file.buffer, chunkNumber, req.body);
      return res.status(202).json({ success: true, data });
    } catch (err) {
      return sendError(res, err, `/voicedoc/sessions/${id}/chunks`);
    }
  });
};

const endSession = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await voicedocService.endSession(id);
    return res.status(data.alreadyEnded ? 200 : 202).json({ success: true, data });
  } catch (err) {
    return sendError(res, err, `/voicedoc/sessions/${id}/end`);
  }
};

const getByVisit = async (req, res) => {
  const { visitUuid } = req.params;
  try {
    const data = await voicedocService.getByVisit(visitUuid);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendError(res, err, `/voicedoc/visit/${visitUuid}`);
  }
};

const requireAdmin = async (req, res, next) => {
  const userId = req.user && req.user.data && req.user.data.userId;
  let admin = false;
  try {
    admin = await openmrs.isAdmin(userId);
  } catch (err) {
    logStream('error', `VoiceDoc admin check for ${userId} failed: ${err.message}`, 'VoiceDoc');
  }
  if (!admin) {
    return res.status(403).json({ success: false, message: MESSAGES.adminRequired });
  }
  return next();
};

const listTranscripts = async (req, res) => {
  try {
    const data = await voicedocService.listTranscripts(req.query || {});
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendError(res, err, '/voicedoc/transcripts');
  }
};

const getTranscript = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await voicedocService.getTranscript(id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendError(res, err, `/voicedoc/transcripts/${id}`);
  }
};

const regenerateVisitSummary = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await voicedocService.regenerateVisitSummary(id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendError(res, err, `/voicedoc/transcripts/${id}/visit-summary`);
  }
};

module.exports = { createSession, uploadChunk, endSession, getByVisit, requireAdmin, listTranscripts, getTranscript, regenerateVisitSummary };
