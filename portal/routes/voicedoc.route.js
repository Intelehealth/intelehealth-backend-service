'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createSession,
  uploadChunk,
  endSession,
  getByVisit,
  requireAdmin,
  listTranscripts,
  getTranscript,
  regenerateVisitSummary,
} = require('../controllers/voicedoc.controller');

router.get('/transcripts', [authMiddleware, requireAdmin, listTranscripts]);
router.get('/transcripts/:id', [authMiddleware, requireAdmin, getTranscript]);
router.post('/transcripts/:id/visit-summary', [authMiddleware, requireAdmin, regenerateVisitSummary]);
router.post('/sessions', [authMiddleware, createSession]);
router.post('/sessions/:id/chunks', [authMiddleware, uploadChunk]);
router.post('/sessions/:id/end', [authMiddleware, endSession]);
router.get('/visit/:visitUuid', [authMiddleware, getByVisit]);

module.exports = router;
