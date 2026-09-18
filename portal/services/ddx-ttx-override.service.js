'use strict';
const { ddx_ttx_override } = require('../models');
const { capRawSuggestion } = require('./ai-issue-report.service');

// Merge by name so an untouched diagnosis keeps its previously-recorded reason.
function mergeDiagnoses(existingList, newList) {
  const map = new Map((existingList || []).map(d => [d.name, d]));
  for (const d of (newList || [])) {
    const prior = map.get(d.name);
    map.set(d.name, {
      name: d.name,
      ai_assisted: d.ai_assisted,
      ...(d.reason || prior?.reason ? { reason: d.reason || prior.reason } : {})
    });
  }
  return Array.from(map.values());
}

async function upsert(payload) {
  const existing = await ddx_ttx_override.findOne({ where: { visit_id: payload.visit_id } });

  const diagnoses = capRawSuggestion(mergeDiagnoses(existing?.diagnoses, payload.diagnoses));
  const treatments = capRawSuggestion([...(existing?.treatments || []), ...(payload.treatments || [])]);

  if (existing) {
    await existing.update({
      doctor_id: payload.doctor_id,
      patient_id: payload.patient_id,
      diagnoses,
      treatments
    });
    return existing;
  }

  return ddx_ttx_override.create({
    visit_id: payload.visit_id,
    doctor_id: payload.doctor_id,
    patient_id: payload.patient_id,
    diagnoses,
    treatments
  });
}

async function list(criteria = {}) {
  const page = Math.max(1, Number(criteria.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(criteria.pageSize) || 20));
  const where = {};
  if (criteria.visit_id) where.visit_id = criteria.visit_id;
  if (criteria.doctor_id) where.doctor_id = criteria.doctor_id;

  const { count, rows } = await ddx_ttx_override.findAndCountAll({
    where,
    order: [['updatedAt', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });

  return { total: count, rows };
}

module.exports = { upsert, list };
