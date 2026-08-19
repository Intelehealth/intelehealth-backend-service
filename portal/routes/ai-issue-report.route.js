'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const isAdmin = require('../middleware/is-admin');
const { create, list } = require('../controllers/ai-issue-report.controller');

router.post('/', [authMiddleware, create]);
router.get('/', [authMiddleware, isAdmin, list]);

module.exports = router;
