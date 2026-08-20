'use strict';
const crypto = require('crypto');
const { ai_issue_report } = require('../models');
const slackService = require('./slack.service');

const RAW_SUGGESTION_LIMIT = 8000;

/**
 * AI-generated diagnosis/medication reasons are model text, not
 * contractually bounded in length. Cap what gets stored rather than reject
 * the write, so a verbose model response never blocks a doctor's report.
 */
function capRawSuggestion(rawSuggestion) {
  if (rawSuggestion == null) return null;
  let serialised;
  try {
    serialised = JSON.stringify(rawSuggestion);
  } catch (e) {
    return null;
  }
  if (serialised.length <= RAW_SUGGESTION_LIMIT) return rawSuggestion;

  const truncateReasons = (item) => {
    if (item && Array.isArray(item.reasons)) {
      return { ...item, reasons: item.reasons.slice(0, 2), _truncated: true };
    }
    return item;
  };

  const truncated = Array.isArray(rawSuggestion)
    ? rawSuggestion.map(truncateReasons)
    : truncateReasons(rawSuggestion);

  return truncated;
}

async function create(payload) {
  const row = await ai_issue_report.create({
    report_uuid: crypto.randomUUID(),
    visit_uuid: payload.visit_uuid,
    doctor_uuid: payload.doctor_uuid,
    patient_uuid: payload.patient_uuid,
    ai_surface: payload.ai_surface,
    suggestion_ref: payload.suggestion_ref || null,
    reason: payload.reason,
    details: payload.details || null,
    raw_suggestion: capRawSuggestion(payload.raw_suggestion),
    status: 'open'
  });

  // doctor_name / patient_openmrs_id are display-only context for the Slack
  // card - never persisted on the report row, since the table is meant to
  // stay de-identified (refs/uuids only).
  // Fired after the create resolves and deliberately not awaited - a slow or
  // unreachable Slack must never delay or fail the doctor's submission.
  slackService.notifyAiIssueReport(row, {
    doctor_name: payload.doctor_name,
    patient_openmrs_id: payload.patient_openmrs_id,
  }).catch(() => {});

  return row;
}

async function list(criteria = {}) {
  const page = Math.max(1, Number(criteria.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(criteria.pageSize) || 20));
  const where = {};
  if (criteria.status) where.status = criteria.status;
  if (criteria.ai_surface) where.ai_surface = criteria.ai_surface;

  const { count, rows } = await ai_issue_report.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });

  return { total: count, rows };
}

module.exports = { create, list, capRawSuggestion };
