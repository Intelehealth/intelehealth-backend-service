'use strict';
const { Op } = require('sequelize');
const { ai_ddx_result, visit_queue } = require('../models');
const { visit, person } = require('../openmrs_models');

const STATUS_DONE = 'done';
const STATUS_PENDING = 'pending';
const QUEUE_WAITING = 'waiting';
const QUEUE_PROCESSING = 'processing';
const QUEUE_PENDING_STATUSES = [QUEUE_WAITING, QUEUE_PROCESSING];
const PRIORITY_HIGH = 'high';

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
  const queued = await visit_queue.findOne({
    where: {
      visit_uuid: visitUuid,
      status: { [Op.in]: QUEUE_PENDING_STATUSES },
    },
  });
  if (queued) {
    return STATUS_PENDING;
  }
  const row = await ai_ddx_result.findOne({ where: { visit_uuid: visitUuid } });
  return row ? row.status : null;
};

const loadVisitForQueue = async (visitUuid) => {
  const row = await visit.findOne({
    where: { uuid: visitUuid, voided: 0 },
    attributes: ['visit_id', 'date_created'],
    include: [{ model: person, as: 'person', attributes: ['uuid'] }],
  });
  if (!row) {
    return null;
  }
  return {
    visit_id: row.visit_id,
    visit_created_at: row.date_created,
    patient_uuid: row.person?.uuid || null,
  };
};

const requeue = async (visitUuid) => {
  const existing = await visit_queue.findOne({ where: { visit_uuid: visitUuid } });

  if (existing) {
    if (existing.status === QUEUE_PROCESSING) {
      return { queued: true };
    }
    await existing.update({
      status: QUEUE_WAITING,
      attempts: 0,
      picked_at: null,
      priority: PRIORITY_HIGH,
    });
    return { queued: true };
  }

  const visitRow = await loadVisitForQueue(visitUuid);
  if (!visitRow) {
    return { queued: false };
  }
  try {
    await visit_queue.create({
      visit_uuid: visitUuid,
      ...visitRow,
      priority: PRIORITY_HIGH,
      status: QUEUE_WAITING,
      attempts: 0,
    });
  } catch (error) {
    if (error.name !== 'SequelizeUniqueConstraintError') {
      throw error;
    }
    return requeue(visitUuid);
  }
  return { queued: true };
};

module.exports = {
  getStoredDdx,
  getStatus,
  requeue,
};
