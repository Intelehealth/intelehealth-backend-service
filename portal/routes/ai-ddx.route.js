'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getDdx, retryDdx, notifyDdx } = require('../controllers/ai-ddx.controller');

router.post('/notify', notifyDdx);
router.get('/:visitUuid', [authMiddleware, getDdx]);
router.post('/:visitUuid/retry', [authMiddleware, retryDdx]);

module.exports = router;
