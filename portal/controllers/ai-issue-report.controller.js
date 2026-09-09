'use strict';
const aiIssueReportService = require('../services/ai-issue-report.service');
const { logStream } = require('../logger/index');

const REQUIRED_FIELDS = ['visit_uuid', 'doctor_uuid', 'patient_uuid', 'ai_surface', 'reason'];

/**
 * Unlike insight.controller.js's record(), which always returns 202 even on
 * failure (it's fire-and-forget telemetry the doctor never sees), this is a
 * doctor-initiated action with a visible modal/popover waiting on the
 * result - a failure here needs to reach that UI as a real error, not be
 * swallowed.
 */
const create = async (req, res) => {
  try {
    const body = req.body || {};
    const missing = REQUIRED_FIELDS.filter(f => !body[f]);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required field(s): ${missing.join(', ')}`
      });
    }
    const row = await aiIssueReportService.create(body);
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    logStream('error', `create error: ${err.message}`, 'AiIssueReports');
    return res.status(500).json({ success: false, message: 'Could not save report' });
  }
};

const list = async (req, res) => {
  try {
    const result = await aiIssueReportService.list(req.query || {});
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logStream('error', `list error: ${err.message}`, 'AiIssueReports');
    return res.status(500).json({ success: false, message: 'Could not list reports' });
  }
};

module.exports = { create, list };
