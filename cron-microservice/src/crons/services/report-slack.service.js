const { parseBoolean } = require("../../config");

const groupMetrics = (metrics) => metrics.reduce((groups, metric) => {
  const section = metric.section || "Other";
  if (!groups.has(section)) groups.set(section, []);
  groups.get(section).push(metric);
  return groups;
}, new Map());

const formatValue = ({ value, unit }) => `${value.toLocaleString("en-US")}${unit || ""}`;

const sectionDetails = (sectionMetrics) => sectionMetrics
  .filter(({ detail }) => detail)
  .map(({ label, detail }) => `*${label}* — ${detail}`);

const buildMessage = ({ reportDate, timezone, metrics }) => {
  const lines = [`Daily Visits & Calls Report — ${reportDate}`, `Timezone: ${timezone}`];
  for (const [section, sectionMetrics] of groupMetrics(metrics)) {
    lines.push("", section, ...sectionMetrics.map((metric) => (
      `${metric.label}: ${formatValue(metric)}`
    )));
    for (const detail of sectionDetails(sectionMetrics)) {
      lines.push(detail.replace(/\*/g, ""));
    }
  }
  return lines.join("\n");
};

const buildSlackPayload = ({ reportDate, timezone, metrics, debug = false }) => {
  const sections = [];
  for (const [section, sectionMetrics] of groupMetrics(metrics)) {
    sections.push({ type: "section", text: { type: "mrkdwn", text: `*${section}*` } });
    const fields = sectionMetrics.map((metric) => ({
      type: "mrkdwn",
      text: `*${metric.label}*\n${formatValue(metric)} · ${metric.source}`,
    }));
    for (let index = 0; index < fields.length; index += 10) {
      sections.push({ type: "section", fields: fields.slice(index, index + 10) });
    }
    const details = sectionDetails(sectionMetrics);
    if (details.length) {
      sections.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: details.join("\n") }],
      });
    }
  }

  return {
    text: `${debug ? "[DEBUG] " : ""}Daily Visits & Calls Report for ${reportDate}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${debug ? "🧪 " : ""}Daily Visits & Calls Report`, emoji: true },
      },
      {
        type: "context",
        elements: [{
          type: "mrkdwn",
          text: `*Date:* ${reportDate}   *Timezone:* ${timezone}   *Environment:* ${process.env.NODE_ENV || "unknown"}`,
        }],
      },
      { type: "divider" },
      ...sections,
    ],
  };
};

const sendSlackReport = async (payload, dependencies = {}) => {
  const debug = parseBoolean(process.env.DAILY_REPORT_SLACK_DEBUG);
  const webhook = debug
    ? process.env.SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL
    : process.env.SLACK_DAILY_REPORT_WEBHOOK_URL;

  if (debug && !webhook) {
    (dependencies.logger || console).info(JSON.stringify(payload, null, 2));
    return "debug";
  }
  if (!webhook) return "skipped";

  const request = dependencies.fetch || fetch;
  const response = await request(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Slack webhook returned ${response.status}`);
  return debug ? "debug" : "sent";
};

module.exports = { buildMessage, buildSlackPayload, sendSlackReport };
