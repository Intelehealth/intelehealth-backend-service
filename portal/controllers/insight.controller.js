'use strict';
const insightService = require('../services/insight.service');
const { logStream } = require('../logger/index');

const actorFromReq = (req) => {
  const userId = req.user && req.user.data && req.user.data.userId;
  return userId ? { actor_type: 'doctor', actor_id: String(userId) } : {};
};

const record = async (req, res) => {
  try {
    const body = req.body || {};
    if (body.event_name) {
      await insightService.record({ ...body, ...actorFromReq(req), source: body.source || 'webapp' });
    }
    return res.status(202).json({ success: true });
  } catch (err) {
    logStream('error', `record error: ${err.message}`, 'Insights');
    return res.status(202).json({ success: true });
  }
};

const query = async (req, res) => {
  try {
    const result = await insightService.query(req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    logStream('error', `query error: ${err.message}`, 'Insights');
    return res.status(500).json({ success: false, message: 'query failed' });
  }
};

module.exports = { record, query };
