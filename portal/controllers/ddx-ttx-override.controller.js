'use strict';
const ddxTtxOverrideService = require('../services/ddx-ttx-override.service');
const { logStream } = require('../logger/index');

const REQUIRED_FIELDS = ['visit_id', 'doctor_id', 'patient_id'];

const upsert = async (req, res) => {
  try {
    const body = req.body || {};
    const missing = REQUIRED_FIELDS.filter(f => body[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required field(s): ${missing.join(', ')}`
      });
    }
    const row = await ddxTtxOverrideService.upsert(body);
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    logStream('error', `upsert error: ${err.message}`, 'DdxTtxOverrides');
    return res.status(500).json({ success: false, message: 'Could not save override reason' });
  }
};

const list = async (req, res) => {
  try {
    const result = await ddxTtxOverrideService.list(req.query || {});
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logStream('error', `list error: ${err.message}`, 'DdxTtxOverrides');
    return res.status(500).json({ success: false, message: 'Could not list override reasons' });
  }
};

module.exports = { upsert, list };
