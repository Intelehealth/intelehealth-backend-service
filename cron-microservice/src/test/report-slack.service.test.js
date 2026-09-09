const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMessage, buildSlackPayload, sendSlackReport } = require("../crons/services/report-slack.service");

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
  const payload = buildSlackPayload(report);
  assert.match(message, /Visits with prescriptions today: 128/);
  assert.equal(payload.text, "Daily Visits & Calls Report for 2026-09-01");
  assert.equal(payload.blocks[3].text.text, "*Patients & Visits*");
  assert.equal(payload.blocks[5].text.text, "*Calls & Recordings*");
  assert.match(payload.blocks[6].fields[0].text, /47 · S3/);
});


test("a configured webhook is the only switch on delivery", async () => {
  const key = "SLACK_DAILY_REPORT_WEBHOOK_URL";
  const prior = process.env[key];
  try {
    delete process.env[key];
    assert.equal(await sendSlackReport({ text: "x" }, {
      fetch: async () => assert.fail("must not post without a webhook"),
    }), "skipped");

    process.env[key] = "https://hooks.example/report";
    const posted = [];
    assert.equal(await sendSlackReport({ text: "x" }, {
      fetch: async (url, options) => { posted.push({ url, body: options.body }); return { ok: true }; },
    }), "sent");
    assert.deepEqual(posted.map(({ url }) => url), ["https://hooks.example/report"]);

    await assert.rejects(sendSlackReport({ text: "x" }, {
      fetch: async () => ({ ok: false, status: 500 }),
    }), /Slack webhook returned 500/);
  } finally {
    if (prior == null) delete process.env[key];
    else process.env[key] = prior;
  }
});
