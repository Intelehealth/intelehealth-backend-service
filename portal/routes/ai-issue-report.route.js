'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const isAdmin = require('../middleware/is-admin');
const { create, list } = require('../controllers/ai-issue-report.controller');

const openLocal = process.env.AI_ISSUE_OPEN === 'true' && process.env.NODE_ENV !== 'prod';

router.post('/', openLocal ? [create] : [authMiddleware, create]);
router.get('/', openLocal ? [list] : [authMiddleware, isAdmin, list]);

module.exports = router;
