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

function visitUrl(visitUuid) {
  if (!visitUuid) return null;
  const configured = process.env.DOCTOR_WEBAPP_URL;
  const base = (configured || (process.env.DOMAIN ? `https://${process.env.DOMAIN}/intelehealth` : ''))
    .trim()
    .replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/#/dashboard/visit-summary/${visitUuid}`;
}

function environmentLabel() {
  const raw = (process.env.NODE_ENV || '').trim().toLowerCase();
  if (raw === 'development' || raw === 'dev') return 'Development';
  if (raw === 'production' || raw === 'prod') return 'Production';
  return raw || '_unknown_';
}

function reportedFrom() {
  const domain = process.env.DOMAIN;
  return domain ? `https://${domain}` : '_unknown_';
}

function patientLabel(report) {
  if (report.patient_openmrs_id) return report.patient_openmrs_id;
  if (report.patient_uuid) return `_no OpenMRS ID_ · \`${report.patient_uuid}\``;
  return '_unknown_';
}

function reportId(response) {
  const candidates = [response?.report_uuid, response?.report_id, response?.id, response?.data?.report_uuid, response?.data?.report_id, response?.data?.id];
  const found = candidates.find(v => typeof v === 'string' || typeof v === 'number');
  return found != null ? String(found) : null;
}

async function notifyAiIssueReport(report, response) {
  const webhookUrl = process.env.SLACK_AI_ISSUE_WEBHOOK_URL;
  if (!webhookUrl || !report) return;

  const surface = SURFACE_LABELS[report.ai_surface] || report.ai_surface || '_unknown_';
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '❗ New AI issue report', emoji: true } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Surface*\n${surface}` },
        { type: 'mrkdwn', text: `*Reason*\n${report.reason || '-'}` },
        { type: 'mrkdwn', text: `*Doctor*\n${report.doctor_name || '_unknown_'}` },
        { type: 'mrkdwn', text: `*Patient (OpenMRS ID)*\n${patientLabel(report)}` },
        { type: 'mrkdwn', text: `*Environment*\n${environmentLabel()}` },
        { type: 'mrkdwn', text: `*Reported from*\n${reportedFrom()}` },
      ],
    },
  ];
  if (report.suggestion_ref) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Suggestion*\n${report.suggestion_ref}` } });
  }
  if (report.details) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Note*\n${report.details}` } });
  }
  const url = visitUrl(report.visit_uuid);
  if (url) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `<${url}|Open visit summary ↗>` } });
  }
  const ids = [`*Visit* \`${report.visit_uuid || '-'}\``, `*Doctor* \`${report.doctor_uuid || '-'}\``];
  const id = reportId(response);
  if (id) ids.push(`*Report* \`${id}\``);
  blocks.push({ type: 'divider' });
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: ids.join('   ') }] });

  try {
    await axios.post(
      webhookUrl,
      { text: `New AI issue report: ${surface} / ${report.reason}`, blocks },
      { timeout: 5000 }
    );
  } catch (err) {
    logStream('error', `Slack notify failed: ${err.message}`, 'AiIssueReports');
  }
}

module.exports = { notifyAiIssueReport };
