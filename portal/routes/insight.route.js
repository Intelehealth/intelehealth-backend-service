'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { record, query } = require('../controllers/insight.controller');

const openLocal = process.env.INSIGHTS_OPEN === 'true' && process.env.NODE_ENV !== 'prod';

router.post('/', openLocal ? [record] : [authMiddleware, record]);
router.get('/summary', openLocal ? [query] : [authMiddleware, query]);

module.exports = router;
