const test = require("node:test");
const assert = require("node:assert/strict");
const { CronRunner } = require("../crons/runner");

const silentLogger = { info() {}, warn() {}, error() {} };

test("runNow rejects a cron name that was never registered", async () => {
  const runner = new CronRunner({ logger: silentLogger });
  await assert.rejects(runner.runNow("nope", {}), /Unknown cron: nope/);
});

test("runNow refuses to overlap a run already in progress", async () => {
  const runner = new CronRunner({ logger: silentLogger });
  let release;
  runner.register({
    name: "slow", schedule: "* * * * * *", enabled: true, timezone: "UTC",
    task: () => new Promise((resolve) => { release = resolve; }),
  });

  const first = runner.runNow("slow", {});
  const second = await runner.runNow("slow", {});
  assert.deepEqual(second, { alreadyRunning: true });

  release("done");
  assert.equal(await first, "done");
});

test("runNow rethrows the task's failure instead of swallowing it", async () => {
  const runner = new CronRunner({ logger: silentLogger });
  runner.register({
    name: "failing", schedule: "* * * * * *", enabled: true, timezone: "UTC",
    task: async () => { throw new Error("boom"); },
  });
  await assert.rejects(runner.runNow("failing", {}), /boom/);
});

test("runNow passes its options through to the task, same as a scheduled fire would", async () => {
  const runner = new CronRunner({ logger: silentLogger });
  const seen = [];
  runner.register({
    name: "opts", schedule: "* * * * * *", enabled: true, timezone: "UTC",
    task: async (options) => { seen.push(options); return "ok"; },
  });
  const result = await runner.runNow("opts", { force: true });
  assert.equal(result, "ok");
  assert.deepEqual(seen, [{ force: true }]);
});

test("status omits lastResult so a triggered run's metrics do not leak into /health", async () => {
  const runner = new CronRunner({ logger: silentLogger });
  runner.register({
    name: "reporting", schedule: "* * * * * *", enabled: true, timezone: "UTC",
    task: async () => ({ counts: { start_calls: 81 } }),
  });
  await runner.runNow("reporting", {});
  const [entry] = runner.status();
  assert.equal(entry.lastError, null);
  assert.equal("lastResult" in entry, false);
});
