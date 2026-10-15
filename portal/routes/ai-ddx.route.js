'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getDdx, retryDdx, computeDdx, notifyDdx } = require('../controllers/ai-ddx.controller');

router.post('/notify', notifyDdx);
router.get('/:visitUuid', [authMiddleware, getDdx]);
router.post('/:visitUuid/retry', [authMiddleware, retryDdx]);
router.post('/:visitUuid/compute', [authMiddleware, computeDdx]);

module.exports = router;
