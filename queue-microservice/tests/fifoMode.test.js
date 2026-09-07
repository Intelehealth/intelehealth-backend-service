// Must be set before src/config/env is first required.
process.env.PRIORITY_ENGINE_ENABLED = "false";

const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../src/config/env");
const queueLane = require("../src/services/queueLane.service");
const { runAgingTick } = require("../src/jobs/aging.job");
const { runSlaTick } = require("../src/jobs/slaPromote.job");
const { STATUS, EMERGENCY_LEVEL } = require("../src/constants");

/**
 * PRIORITY_ENGINE_ENABLED=false — strict first-come-first-served.
 *
 * The contract is narrow and absolute: a visit joins at the BACK of the line
 * and nothing moves it. That means every mechanism capable of reordering has to
 * be off, not merely de-weighted — the critical fast lane, the escalation lane,
 * the aging curve and the SLA force-promote all have to stand down together.
 * Leaving any one of them running would silently reintroduce queue-jumping.
 */

test("FIFO is the shipped default, not just this file's setting", () => {
  assert.equal(config.queue.priorityEngineEnabled, false);

  // The code default is false too, so a deployment that never sets the variable
  // gets strict FIFO rather than a ranking algorithm whose point values have no
  // clinical sign-off (Priority Engine spec §00).
  const src = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "src", "config", "env.js"),
    "utf8"
  );
  assert.match(
    src,
    /priorityEngineEnabled:\s*bool\(process\.env\.PRIORITY_ENGINE_ENABLED,\s*false\)/,
    "the fallback in config/env.js must stay false"
  );
});

test("there is exactly one lane, ordered by arrival", () => {
  const lanes = queueLane.lanesInOrder({ speciality: "General Physician" });

  assert.equal(lanes.length, 1, "any second lane is a way to jump the queue");
  assert.equal(lanes[0].name, "FIFO");
  assert.deepEqual(lanes[0].order, [
    ["queuedAt", "ASC"],
    ["id", "ASC"],
  ]);
});

test("the single lane holds every waiting case, whatever its urgency", () => {
  const [lane] = queueLane.lanesInOrder({ speciality: "X" });
  // No emergency_level or escalated predicate — that is what makes it one line.
  assert.ok(!("emergencyLevel" in lane.where));
  assert.ok(!("escalated" in lane.where));
  assert.deepEqual(lane.where.status, { [require("sequelize").Op.in]: ["QUEUED", "ESCALATED"] });
});

test("no case is special — laneOf is FIFO regardless of level or status", () => {
  const cases = [
    { emergencyLevel: EMERGENCY_LEVEL.CRITICAL, status: STATUS.QUEUED },
    { emergencyLevel: EMERGENCY_LEVEL.LOW, status: STATUS.QUEUED },
    // Even a row escalated while the engine was still on.
    { emergencyLevel: EMERGENCY_LEVEL.LOW, status: STATUS.ESCALATED },
  ];
  for (const c of cases) assert.equal(queueLane.laneOf(c), "FIFO");
});

test("list ordering is arrival order with no lane clauses in front of it", () => {
  const order = queueLane.listOrder();
  assert.deepEqual(order, [
    ["queuedAt", "ASC"],
    ["id", "ASC"],
  ]);
  // A literal here would be an (emergency_level = 'CRITICAL') DESC style clause.
  for (const term of order) assert.ok(Array.isArray(term), "no lane-priority literal may survive");
});

test("the aging job stands down rather than drifting scores nothing reads", async () => {
  const result = await runAgingTick();
  assert.equal(result.disabled, true);
  assert.equal(result.aged, 0);
  assert.equal(result.scanned, 0);
});

test("the SLA force-promote job stands down — nothing may reach the front", async () => {
  const result = await runSlaTick();
  assert.equal(result.disabled, true);
  assert.equal(result.escalated, 0);
});
