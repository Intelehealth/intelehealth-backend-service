const test = require("node:test");
const assert = require("node:assert/strict");
const moment = require("moment-timezone");
const { reportPeriod, runDailyOperationsReport } = require("../crons/jobs/daily-operations-report.job");

test("calculates the current reporting day in the configured timezone", () => {
  const priorTimezone = process.env.CRON_TIMEZONE;
  process.env.CRON_TIMEZONE = "Asia/Kolkata";
  try {
    const period = reportPeriod(moment.utc("2026-09-01T18:25:00.000Z"));
    assert.equal(period.reportDate, "2026-09-01");
    assert.equal(period.start.toISOString(), "2026-08-31T18:30:00.000Z");
    assert.equal(period.end.toISOString(), "2026-09-01T18:25:00.000Z");
  } finally {
    if (priorTimezone == null) delete process.env.CRON_TIMEZONE;
    else process.env.CRON_TIMEZONE = priorTimezone;
  }
});

test("persists metrics before Slack delivery and prevents duplicates", async () => {
  const updates = [];
  const row = { update: async (values) => updates.push(values) };
  const dependencies = {
    repository: { findOrCreate: async () => [row, true] },
    collectDatabaseMetrics: async () => [
      { name: "visits", label: "Visits", section: "Patients & Visits", value: 12, source: "OpenMRS DB" },
    ],
    collectS3Metrics: async () => [
      { name: "recordings", label: "Recordings", section: "Calls & Recordings", value: 5, source: "S3" },
    ],
    sendSlackReport: async () => "sent",
  };

  await runDailyOperationsReport({ dependencies });
  assert.equal(updates[0].metrics.length, 2);
  assert.deepEqual(updates[1], { status: "completed", slack_status: "sent" });

  const existing = { id: 1, status: "completed" };
  const duplicate = await runDailyOperationsReport({
    dependencies: { repository: { findOrCreate: async () => [existing, false] } },
  });
  assert.deepEqual(duplicate, { skipped: true, report: existing });
});

test("retries a report left behind by a failed run, but not a completed one", async () => {
  const period = { reportDate: "2026-09-02", timezone: "Asia/Kolkata" };
  const build = (status) => {
    const report = { status, updates: [] };
    report.update = async (values) => { Object.assign(report, values); report.updates.push(values); return report; };
    return report;
  };
  const run = async (report) => runDailyOperationsReport({
    now: moment.tz("2026-09-02 23:55:00", "Asia/Kolkata"),
    dependencies: {
      repository: { findOrCreate: async () => [report, false] },
      collectDatabaseMetrics: async () => [{ name: "m", label: "M", section: "S", value: 1, source: "Portal DB" }],
      collectS3Metrics: async () => [],
      collectGaMetrics: async () => [],
      sendSlackReport: async () => "debug",
    },
  });

  const failed = build("failed");
  const result = await run(failed);
  assert.equal(result.skipped, undefined);
  assert.equal(failed.status, "completed");

  const completed = build("completed");
  assert.equal((await run(completed)).skipped, true);
});
