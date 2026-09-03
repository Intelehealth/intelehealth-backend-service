const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMessage, buildSlackPayload, sendSlackReport, slackTarget } = require("../crons/services/report-slack.service");

const report = {
  reportDate: "2026-09-01",
  timezone: "Asia/Kolkata",
  metrics: [
    { label: "Visits with prescriptions today", section: "Patients & Visits", value: 128, source: "OpenMRS DB" },
    { label: "WebRTC recordings today", section: "Calls & Recordings", value: 47, source: "S3" },
  ],
};

test("builds database and Slack messages", () => {
  const message = buildMessage(report);
  const payload = buildSlackPayload({ ...report, debug: true });
  assert.match(message, /Visits with prescriptions today: 128/);
  assert.equal(payload.text, "[DEBUG] Daily Visits & Calls Report for 2026-09-01");
  assert.equal(payload.blocks[3].text.text, "*Patients & Visits*");
  assert.equal(payload.blocks[5].text.text, "*Calls & Recordings*");
  assert.match(payload.blocks[6].fields[0].text, /47 · S3/);
});

test("prints the exact payload in debug mode without a webhook", async () => {
  const priorDebug = process.env.DAILY_REPORT_SLACK_DEBUG;
  const priorWebhook = process.env.SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL;
  process.env.DAILY_REPORT_SLACK_DEBUG = "true";
  delete process.env.SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL;
  let output;

  try {
    const status = await sendSlackReport({ text: "preview" }, {
      logger: { info: (value) => { output = value; } },
    });
    assert.equal(status, "debug");
    assert.deepEqual(JSON.parse(output), { text: "preview" });
  } finally {
    if (priorDebug == null) delete process.env.DAILY_REPORT_SLACK_DEBUG;
    else process.env.DAILY_REPORT_SLACK_DEBUG = priorDebug;
    if (priorWebhook == null) delete process.env.SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL;
    else process.env.SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL = priorWebhook;
  }
});

test("sends whenever a report webhook is configured; debug is an explicit override", async () => {
  const keys = ["DAILY_REPORT_SLACK_DEBUG", "SLACK_DAILY_REPORT_WEBHOOK_URL", "SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL"];
  const prior = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const set = (values) => {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, values);
  };

  try {
    set({ SLACK_DAILY_REPORT_WEBHOOK_URL: "https://hooks.example/report" });
    assert.deepEqual(slackTarget(), { debug: false, webhook: "https://hooks.example/report" });

    set({});
    assert.deepEqual(slackTarget(), { debug: false, webhook: undefined });

    set({
      DAILY_REPORT_SLACK_DEBUG: "true",
      SLACK_DAILY_REPORT_WEBHOOK_URL: "https://hooks.example/report",
      SLACK_DAILY_REPORT_DEBUG_WEBHOOK_URL: "https://hooks.example/debug",
    });
    assert.deepEqual(slackTarget(), { debug: true, webhook: "https://hooks.example/debug" });

    set({ DAILY_REPORT_SLACK_DEBUG: "true", SLACK_DAILY_REPORT_WEBHOOK_URL: "https://hooks.example/report" });
    assert.deepEqual(slackTarget(), { debug: true, webhook: "https://hooks.example/report" });

    set({ SLACK_DAILY_REPORT_WEBHOOK_URL: "https://hooks.example/report" });
    const calls = [];
    const status = await sendSlackReport({ text: "x" }, {
      fetch: async (url) => { calls.push(url); return { ok: true }; },
    });
    assert.equal(status, "sent");
    assert.deepEqual(calls, ["https://hooks.example/report"]);
  } finally {
    for (const k of keys) {
      if (prior[k] == null) delete process.env[k];
      else process.env[k] = prior[k];
    }
  }
});
