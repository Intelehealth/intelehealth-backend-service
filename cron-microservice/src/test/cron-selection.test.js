const test = require("node:test");
const assert = require("node:assert/strict");
const { selectCrons } = require("../crons");
const { CronRunner } = require("../crons/runner");

const silentLogger = { info() {}, warn() {}, error() {} };
const task = async () => "ok";
const definitions = () => [
  { name: "a", schedule: "* * * * * *", flag: "A_ENABLED", enabled: true, task },
  { name: "b", schedule: "* * * * * *", flag: "B_ENABLED", enabled: true, task },
  { name: "c", schedule: "* * * * * *", flag: "C_ENABLED", enabled: false, task },
];
const summary = (selected) => Object.fromEntries(selected.map(({ name, disabledReason }) => [name, disabledReason]));

test("each cron follows its own flag when no list is set", () => {
  assert.deepEqual(summary(selectCrons(definitions(), {})), { a: null, b: null, c: "C_ENABLED=false" });
});

test("CRONS_DISABLED turns off the named crons only", () => {
  assert.deepEqual(summary(selectCrons(definitions(), { CRONS_DISABLED: " b " })), {
    a: null, b: "listed in CRONS_DISABLED", c: "C_ENABLED=false",
  });
});

test("CRONS_ONLY narrows but never overrides a cron's own flag", () => {
  assert.deepEqual(summary(selectCrons(definitions(), { CRONS_ONLY: "a,c" })), {
    a: null, b: "not listed in CRONS_ONLY", c: "C_ENABLED=false",
  });
});

test("CRONS_DISABLED wins over CRONS_ONLY", () => {
  assert.equal(summary(selectCrons(definitions(), { CRONS_ONLY: "a", CRONS_DISABLED: "a" })).a, "listed in CRONS_DISABLED");
});

test("CRONS_ENABLED=false turns everything off", () => {
  const reasons = Object.values(summary(selectCrons(definitions(), { CRONS_ENABLED: "false", CRONS_ONLY: "a" })));
  assert.deepEqual(reasons, Array(3).fill("CRONS_ENABLED=false"));
});

test("a misspelt cron name fails start-up instead of being silently ignored", () => {
  assert.throws(() => selectCrons(definitions(), { CRONS_DISABLED: "ddx-wroker" }), /Unknown cron in CRONS_ONLY\/CRONS_DISABLED: ddx-wroker/);
});

test("a disabled cron is reported in status and refuses a manual run", async () => {
  const runner = new CronRunner({ logger: silentLogger });
  for (const definition of selectCrons(definitions(), { CRONS_DISABLED: "b" })) runner.register(definition);
  assert.equal(runner.start(), 1);
  runner.stop();
  const b = runner.status().find(({ name }) => name === "b");
  assert.deepEqual({ enabled: b.enabled, disabledReason: b.disabledReason }, { enabled: false, disabledReason: "listed in CRONS_DISABLED" });
  await assert.rejects(runner.runNow("b", {}), /Cron disabled: b \(listed in CRONS_DISABLED\)/);
});
