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
 * Deep link to the visit in the doctor webapp, so a reviewer can open the case
 * straight from the card. DOCTOR_WEBAPP_URL overrides the location for
 * deployments that do not serve the webapp at /intelehealth on DOMAIN (and for
 * local testing, where it is http://localhost:4200).
 */
function visitUrl(visitUuid) {
  if (!visitUuid) return null;
  const configured = process.env.DOCTOR_WEBAPP_URL;
  const base = (configured || (process.env.DOMAIN ? `https://${process.env.DOMAIN}/intelehealth` : ''))
    .trim()
    .replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/#/dashboard/visit-summary/${visitUuid}`;
}

/**
 * Which deployment tier this is, normalised from NODE_ENV so 'dev' and
 * 'development' (and 'prod'/'production') render identically.
 */
function environmentLabel() {
  const raw = (process.env.NODE_ENV || '').trim().toLowerCase();
  if (raw === 'development' || raw === 'dev') return 'Development';
  if (raw === 'production' || raw === 'prod') return 'Production';
  return raw || '_unknown_';
}

/**
 * Which server the report came from. Reports land in one Slack channel from
 * every deployment, so without this the card is ambiguous. DOMAIN is the same
 * env var handlers/helper.js builds its OpenMRS baseURL from.
 */
function reportedFrom() {
  const domain = process.env.DOMAIN;
  return domain ? `https://${domain}` : '_unknown_';
}

/**
 * A patient with no OpenMRS ID on record is a real case, not a failure - say
 * so explicitly rather than showing a bare "unknown" that reads like a bug,
 * and fall back to the patient uuid so the report is always traceable.
 */
function patientLabel(row, context) {
  if (context.patient_openmrs_id) return context.patient_openmrs_id;
  if (row.patient_uuid) return `_no OpenMRS ID_ · \`${row.patient_uuid}\``;
  return '_unknown_';
}

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
    { type: 'header', text: { type: 'plain_text', text: '❗ New AI issue report', emoji: true } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Surface*\n${surface}` },
        { type: 'mrkdwn', text: `*Reason*\n${row.reason || '-'}` },
        { type: 'mrkdwn', text: `*Doctor*\n${context.doctor_name || '_unknown_'}` },
        { type: 'mrkdwn', text: `*Patient (OpenMRS ID)*\n${patientLabel(row, context)}` },
        { type: 'mrkdwn', text: `*Environment*\n${environmentLabel()}` },
        { type: 'mrkdwn', text: `*Reported from*\n${reportedFrom()}` },
      ],
    },
  ];
  if (row.suggestion_ref) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Suggestion*\n${row.suggestion_ref}` } });
  }
  if (row.details) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Note*\n${row.details}` } });
  }
  const url = visitUrl(row.visit_uuid);
  if (url) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `<${url}|Open visit summary ↗>` },
    });
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
