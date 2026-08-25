'use strict';
const aiDiagnosisService = require('../services/ai-diagnosis.service');
const { logStream } = require('../logger/index');

const FRIENDLY = {
  unavailable: 'The AI diagnosis service is currently unavailable. Please try again in a few minutes.',
  timeout: 'The AI diagnosis service took too long to respond. Please try again.',
  missingUrl: 'The AI diagnosis service is not configured (missing URL). Please contact support.',
  missingKey: 'The AI diagnosis service is not configured (missing or invalid API key). Please contact support.',
  unexpected: 'Something went wrong while generating the AI suggestion. Please try again, and contact support if this keeps happening.',
};

/*
 * Maps a forwarding failure to a status and a message safe to show a doctor,
 * never leaking the upstream host or API key.
 */
function respondWithError(res, endpoint, err) {
  if (err.code === 'CONFIG_MISSING') {
    logStream('error', `${endpoint}: ${err.message}`, 'AiDiagnosisProxy');
    return res.status(500).json({ success: false, message: FRIENDLY.missingUrl });
  }

  if (err.response) {
    const status = err.response.status;
    logStream('error', `${endpoint} upstream ${status}: ${JSON.stringify(err.response.data)}`, 'AiDiagnosisProxy');
    /* Rejected key is an ops problem, not the doctor's request. */
    if (status === 401 || status === 403) {
      return res.status(500).json({ success: false, message: FRIENDLY.missingKey });
    }
    /* A genuine request-shape problem, safe to surface as-is. */
    if (status === 400 || status === 422) {
      return res.status(status).json(err.response.data);
    }
    return res.status(502).json({ success: false, message: FRIENDLY.unexpected });
  }

  if (err.code === 'ECONNABORTED') {
    logStream('error', `${endpoint} timed out: ${err.message}`, 'AiDiagnosisProxy');
    return res.status(504).json({ success: false, message: FRIENDLY.timeout });
  }

  /* No response at all: DNS failure, refused, or unreachable. */
  logStream('error', `${endpoint} unreachable: ${err.message}`, 'AiDiagnosisProxy');
  return res.status(503).json({ success: false, message: FRIENDLY.unavailable });
}

const ddx = async (req, res) => {
  try {
    const data = await aiDiagnosisService.ddx(req.body);
    return res.status(200).json(data);
  } catch (err) {
    return respondWithError(res, '/ddx', err);
  }
};

const ttxv1 = async (req, res) => {
  try {
    const data = await aiDiagnosisService.ttxv1(req.body);
    return res.status(200).json(data);
  } catch (err) {
    return respondWithError(res, '/ttxv1', err);
  }
};

module.exports = { ddx, ttxv1 };
