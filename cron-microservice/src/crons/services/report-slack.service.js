
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

const failureLines = (failures = []) => failures.map(
  ({ source, message }) => `${source} unavailable — ${message}`
);

const buildMessage = ({ reportDate, timezone, metrics, failures = [] }) => {
  const lines = [`Daily Visits & Calls Report — ${reportDate}`, `Timezone: ${timezone}`];
  if (failures.length) lines.push("", ...failureLines(failures));
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

const buildSlackPayload = ({ reportDate, timezone, metrics, failures = [] }) => {
  const sections = [];
  if (failures.length) {
    sections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: *Incomplete report* — ${failureLines(failures).join("\n")}`,
      },
    });
  }
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
    text: `Daily Visits & Calls Report for ${reportDate}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Daily Visits & Calls Report", emoji: true },
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

/*
  A configured webhook is the whole switch: set SLACK_DAILY_REPORT_WEBHOOK_URL and
  the report is delivered, leave it unset and the run still completes and stores
  its counts, recording "skipped". There is no separate mode to keep in step with
  the routing.
*/
const sendSlackReport = async (payload, dependencies = {}) => {
  const webhook = process.env.SLACK_DAILY_REPORT_WEBHOOK_URL;
  if (!webhook) return "skipped";

  const request = dependencies.fetch || fetch;
  const response = await request(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Slack webhook returned ${response.status}`);
  return "sent";
};

module.exports = { buildMessage, buildSlackPayload, sendSlackReport };
