'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { ddx, ttxv1, ddxfinal, ttxfinal } = require('../controllers/ai-diagnosis.controller');

router.post('/ddx', [authMiddleware, ddx]);
router.post('/ttxv1', [authMiddleware, ttxv1]);
router.post('/ddxfinal', [authMiddleware, ddxfinal]);
router.post('/ttxfinal', [authMiddleware, ttxfinal]);

module.exports = router;
