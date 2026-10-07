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
    withLock: (run) => run(),
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
  assert.deepEqual(updates[0].metrics, { counts: { visits: 12, recordings: 5 } });
  assert.equal(updates[0].message, undefined, "renderings are not persisted");
  assert.equal(updates[0].slack_payload, undefined, "renderings are not persisted");
  assert.deepEqual(updates[1], { status: "completed", slack_status: "sent", error: null });

  const existing = { id: 1, status: "completed" };
  const duplicate = await runDailyOperationsReport({
    dependencies: { withLock: (run) => run(), repository: { findOrCreate: async () => [existing, false] } },
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
      withLock: (run) => run(),
      repository: { findOrCreate: async () => [report, false] },
      collectDatabaseMetrics: async () => [{ name: "m", label: "M", section: "S", value: 1, source: "Portal DB" }],
      collectS3Metrics: async () => [],
      collectGaMetrics: async () => [],
      sendSlackReport: async () => "sent",
    },
  });

  const failed = build("failed");
  const result = await run(failed);
  assert.equal(result.skipped, undefined);
  assert.equal(failed.status, "completed");

  const completed = build("completed");
  assert.equal((await run(completed)).skipped, true);
});

test("a second instance that cannot take the lock does no work", async () => {
  let collected = false;
  const result = await runDailyOperationsReport({
    dependencies: {
      withLock: async () => ({ skipped: true, reason: "locked" }),
      repository: { findOrCreate: async () => { collected = true; return [{}, true]; } },
      collectDatabaseMetrics: async () => { collected = true; return []; },
      collectS3Metrics: async () => [],
      collectGaMetrics: async () => [],
      sendSlackReport: async () => { collected = true; return "sent"; },
    },
  });

  assert.deepEqual(result, { skipped: true, reason: "locked" });
  assert.equal(collected, false, "a locked-out instance must not query, list or post");
});

test("persists counts and measured breakdowns, but nothing derivable from config", async () => {
  const updates = [];
  await runDailyOperationsReport({
    dependencies: {
      withLock: (run) => run(),
      repository: { findOrCreate: async () => [{ update: async (v) => updates.push(v) }, true] },
      collectDatabaseMetrics: async () => [
        { name: "start_calls", label: "Start Call actions today", section: "Calls", value: 81, source: "Portal DB" },
        { name: "recordings_avg_duration", label: "Average", section: "Calls", value: 37, unit: "s", source: "Portal DB" },
      ],
      collectS3Metrics: async () => [
        {
          name: "webrtc_recordings", label: "WebRTC recordings today", section: "Calls",
          value: 35, source: "S3", detail: "Badagi 31 · Remote 2",
          breakdown: { Badagi: 31, Jambhulpada: 2, Remote: 2 },
        },
      ],
      collectGaMetrics: async () => [],
      sendSlackReport: async () => "sent",
    },
  });

  assert.deepEqual(updates[0].metrics, {
    counts: { start_calls: 81, recordings_avg_duration: 37, webrtc_recordings: 35 },
    breakdowns: { webrtc_recordings: { Badagi: 31, Jambhulpada: 2, Remote: 2 } },
  });

  const stored = JSON.stringify(updates[0].metrics);
  for (const derivable of ["label", "section", "source", "unit", "detail", "Portal DB"]) {
    assert.ok(!stored.includes(derivable), `${derivable} must not be persisted`);
  }
});

test("delivers what succeeded when one source fails, and names the failure", async () => {
  const updates = [];
  let delivered;
  const report = await runDailyOperationsReport({
    dependencies: {
      withLock: (run) => run(),
      repository: { findOrCreate: async () => [{ update: async (v) => { updates.push(v); } }, true] },
      collectDatabaseMetrics: async () => [
        { name: "start_calls", label: "Start Call actions today", section: "Calls", value: 81, source: "Portal DB" },
      ],
      collectS3Metrics: async () => [
        { name: "webrtc_recordings", label: "WebRTC recordings today", section: "Calls", value: 35, source: "S3" },
      ],
      collectGaMetrics: async () => { throw new Error("7 PERMISSION_DENIED"); },
      sendSlackReport: async (payload) => { delivered = payload; return "sent"; },
    },
  });

  assert.ok(delivered, "the report must still be delivered");
  assert.deepEqual(updates[0].metrics, { counts: { start_calls: 81, webrtc_recordings: 35 } });

  const final = updates[updates.length - 1];
  assert.equal(final.status, "partial");
  assert.match(final.error, /GA4: 7 PERMISSION_DENIED/);

  const warning = JSON.stringify(delivered.blocks);
  assert.match(warning, /Incomplete report/);
  assert.match(warning, /GA4 unavailable/);
});

test("aborts only when every source fails", async () => {
  const fail = async () => { throw new Error("down"); };
  await assert.rejects(
    runDailyOperationsReport({
      dependencies: {
        withLock: (run) => run(),
        repository: { findOrCreate: async () => [{ update: async () => {} }, true] },
        collectDatabaseMetrics: fail,
        collectS3Metrics: fail,
        collectGaMetrics: fail,
        sendSlackReport: async () => assert.fail("must not deliver an empty report"),
      },
    }),
    /No metric source succeeded/
  );
});
