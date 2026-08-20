'use strict';
const axios = require('axios');
const { logStream } = require('../logger/index');

const SURFACE_LABELS = {
  ddx: 'Diagnosis (DDx)',
  ddx_questions: 'Suggested questions',
  ttx_medication: 'Medication',
  ttx_advice: 'Advice',
  ttx_test: 'Tests',
  ttx_referral: 'Referral',
  ttx_followup: 'Follow-up',
};

/**
 * Best-effort Slack notification for a newly created AI issue report.
 * No-ops when SLACK_AI_ISSUE_WEBHOOK_URL is unset, and never throws - the
 * doctor's submission must not be delayed or failed by Slack being slow or
 * unreachable, so the caller fires this without awaiting it.
 *
 * `context` carries display-only fields (doctor name, patient OpenMRS ID)
 * that exist only for this notification - the report row itself stays
 * de-identified (refs/uuids only), so these never get persisted.
 */
async function notifyAiIssueReport(row, context = {}) {
  const webhookUrl = process.env.SLACK_AI_ISSUE_WEBHOOK_URL;
  if (!webhookUrl || !row) return;

  const surface = SURFACE_LABELS[row.ai_surface] || row.ai_surface;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '🚩 New AI issue report', emoji: true } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Surface*\n${surface}` },
        { type: 'mrkdwn', text: `*Reason*\n${row.reason || '-'}` },
        { type: 'mrkdwn', text: `*Doctor*\n${context.doctor_name || '_unknown_'}` },
        { type: 'mrkdwn', text: `*Patient (OpenMRS ID)*\n${context.patient_openmrs_id || '_unknown_'}` },
      ],
    },
  ];
  if (row.suggestion_ref) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Suggestion*\n${row.suggestion_ref}` } });
  }
  if (row.details) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Note*\n${row.details}` } });
  }
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*Visit* \`${row.visit_uuid}\`   *Doctor* \`${row.doctor_uuid}\`   *Report* \`${row.report_uuid}\``,
      },
    ],
  });

  try {
    await axios.post(
      webhookUrl,
      { text: `New AI issue report: ${surface} / ${row.reason}`, blocks },
      { timeout: 5000 }
    );
  } catch (err) {
    logStream('error', `Slack notify failed: ${err.message}`, 'AiIssueReports');
  }
}

module.exports = { notifyAiIssueReport };
