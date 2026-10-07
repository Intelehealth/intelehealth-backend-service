'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getDdx } = require('../controllers/ai-ddx.controller');

router.get('/:visitUuid', [authMiddleware, getDdx]);

module.exports = router;
