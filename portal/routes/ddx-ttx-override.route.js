'use strict';
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const isAdmin = require('../middleware/is-admin');
const { upsert, list } = require('../controllers/ddx-ttx-override.controller');

router.post('/', [authMiddleware, upsert]);
router.get('/', [authMiddleware, isAdmin, list]);

module.exports = router;
