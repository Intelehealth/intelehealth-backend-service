'use strict';
const crypto = require('crypto');
const aiDdxService = require('../services/ai-ddx.service');
const { emitAiDdxStatus } = require('../handlers/ai-ddx-socket');
const { logStream } = require('../logger/index');

const MESSAGES = {
  missingVisit: 'visitUuid is required.',
  pending: 'The AI diagnosis for this visit is still being generated.',
  notFound: 'No AI diagnosis has been generated for this visit yet.',
  failed: 'The AI diagnosis for this visit could not be generated.',
  queued: 'The AI diagnosis for this visit has been queued for regeneration.',
  visitNotFound: 'This visit could not be found.',
  unexpected: 'Something went wrong while fetching the AI suggestion. Please try again, and contact support if this keeps happening.',
};

const getDdx = async (req, res) => {
  const { visitUuid } = req.params;

  if (!visitUuid) {
    return res.status(400).json({ success: false, message: MESSAGES.missingVisit });
  }

  try {
    const response = await aiDdxService.getStoredDdx(visitUuid);
    if (response) {
      return res.status(200).json(response);
    }

    const status = await aiDdxService.getStatus(visitUuid);
    if (status === 'pending' || status === 'processing') {
      return res.status(202).json({ success: false, status: 'pending', message: MESSAGES.pending });
    }
    if (status === 'failed') {
      return res.status(404).json({ success: false, status: 'failed', message: MESSAGES.failed });
    }

    return res.status(404).json({ success: false, status: 'not_found', message: MESSAGES.notFound });
  } catch (err) {
    logStream('error', `/ai-ddx/${visitUuid} failed: ${err.message}`, 'AiDdx');
    return res.status(500).json({ success: false, message: MESSAGES.unexpected });
  }
};

const retryDdx = async (req, res) => {
  const { visitUuid } = req.params;

  if (!visitUuid) {
    return res.status(400).json({ success: false, message: MESSAGES.missingVisit });
  }

  try {
    const { queued } = await aiDdxService.requeue(visitUuid);
    if (!queued) {
      return res.status(404).json({ success: false, status: 'not_found', message: MESSAGES.visitNotFound });
    }
    return res.status(202).json({ success: true, status: 'pending', message: MESSAGES.queued });
  } catch (err) {
    logStream('error', `/ai-ddx/${visitUuid}/retry failed: ${err.message}`, 'AiDdx');
    return res.status(500).json({ success: false, message: MESSAGES.unexpected });
  }
};

const NOTIFY_STATUSES = ['done', 'failed'];

const notifyTokenMatches = (req) => {
  const expected = Buffer.from(process.env.AI_DDX_NOTIFY_TOKEN || '');
  const presented = Buffer.from(String(req.header('X-AI-DDX-Notify-Token') || ''));
  return expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
};

const notifyDdx = (req, res) => {
  if (!process.env.AI_DDX_NOTIFY_TOKEN) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  if (!notifyTokenMatches(req)) {
    return res.status(401).json({ success: false, message: 'Invalid notify token' });
  }
  const { visitUuid, status } = req.body || {};
  if (typeof visitUuid !== 'string' || !NOTIFY_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'visitUuid and a done/failed status are required.' });
  }
  emitAiDdxStatus(visitUuid, status);
  return res.status(204).end();
};

module.exports = { getDdx, retryDdx, notifyDdx };
