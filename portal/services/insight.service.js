'use strict';
const crypto = require('crypto');
const { Op } = require('sequelize');
const { insight_event } = require('../models');
const { logStream } = require('../logger/index');

const normalize = (event) => {
  const now = new Date();
  return {
    event_uuid: event.event_uuid || crypto.randomUUID(),
    event_name: event.event_name,
    source: event.source,
    actor_type: event.actor_type || null,
    actor_id: event.actor_id || null,
    entity_type: event.entity_type || null,
    entity_id: event.entity_id || null,
    properties: event.properties || null,
    occurred_at: event.occurred_at ? new Date(event.occurred_at) : now
  };
};

const record = async (event) => {
  try {
    if (!event || !event.event_name || !event.source) return { ok: false, reason: 'invalid' };
    await insight_event.create(normalize(event));
    return { ok: true };
  } catch (err) {
    if (err && err.name === 'SequelizeUniqueConstraintError') return { ok: true, deduped: true };
    logStream('error', `record failed: ${err.message}`, 'Insights');
    return { ok: false };
  }
};

const query = async (criteria = {}) => {
  const where = {};
  if (criteria.event_name) where.event_name = criteria.event_name;
  if (criteria.source) where.source = criteria.source;
  if (criteria.actor_id) where.actor_id = criteria.actor_id;
  if (criteria.entity_type) where.entity_type = criteria.entity_type;
  if (criteria.entity_id) where.entity_id = criteria.entity_id;
  if (criteria.from || criteria.to) {
    where.occurred_at = {};
    if (criteria.from) where.occurred_at[Op.gte] = new Date(criteria.from);
    if (criteria.to) where.occurred_at[Op.lte] = new Date(criteria.to);
  }
  const limit = Math.min(parseInt(criteria.limit, 10) || 100, 1000);
  const rows = await insight_event.findAll({ where, order: [['occurred_at', 'DESC']], limit });
  const total = await insight_event.count({ where });
  const distinctActors = await insight_event.count({ where, distinct: true, col: 'actor_id' });
  return { total, distinctActors, rows };
};

module.exports = { record, query };
