'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { ddx, ttxv1, ddxfinal, ttxfinal, ddxManual, ttxManual, ddxError, ttxError } = require('../controllers/ai-diagnosis.controller');

router.post('/ddx', [authMiddleware, ddx]);
router.post('/ttxv1', [authMiddleware, ttxv1]);
router.post('/ddxfinal', [authMiddleware, ddxfinal]);
router.post('/ttxfinal', [authMiddleware, ttxfinal]);
router.post('/ddx/manual', [authMiddleware, ddxManual]);
router.post('/ttx/manual', [authMiddleware, ttxManual]);
router.post('/ddx/error', [authMiddleware, ddxError]);
router.post('/ttx/error', [authMiddleware, ttxError]);

module.exports = router;
