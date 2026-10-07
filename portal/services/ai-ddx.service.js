'use strict';
const { Op } = require('sequelize');
const { ai_ddx_result, visit_queue } = require('../models');

const STATUS_DONE = 'done';
const STATUS_PENDING = 'pending';
const QUEUE_PENDING_STATUSES = ['waiting', 'processing'];

const getStoredDdx = async (visitUuid) => {
  const row = await ai_ddx_result.findOne({
    where: { visit_uuid: visitUuid, status: STATUS_DONE },
  });
  if (!row || !row.response) {
    return null;
  }
  return row.response;
};

const getStatus = async (visitUuid) => {
  const row = await ai_ddx_result.findOne({ where: { visit_uuid: visitUuid } });
  if (row) {
    return row.status;
  }
  const queued = await visit_queue.findOne({
    where: {
      visit_uuid: visitUuid,
      status: { [Op.in]: QUEUE_PENDING_STATUSES },
    },
  });
  return queued ? STATUS_PENDING : null;
};

module.exports = {
  getStoredDdx,
  getStatus,
};
