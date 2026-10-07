'use strict';
const aiDdxService = require('../services/ai-ddx.service');
const { logStream } = require('../logger/index');

const MESSAGES = {
  missingVisit: 'visitUuid is required.',
  pending: 'The AI diagnosis for this visit is still being generated.',
  notFound: 'No AI diagnosis has been generated for this visit yet.',
  failed: 'The AI diagnosis for this visit could not be generated.',
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

module.exports = { getDdx };
