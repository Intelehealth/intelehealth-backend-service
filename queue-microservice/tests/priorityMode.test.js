// Must be set before src/config/env is first required.
process.env.PRIORITY_ENGINE_ENABLED = "true";

const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../src/config/env");
const queueLane = require("../src/services/queueLane.service");
const { STATUS, EMERGENCY_LEVEL } = require("../src/constants");

/**
 * PRIORITY_ENGINE_ENABLED=true — the opt-in mode.
 *
 * The engine now defaults OFF, so without this file the three-lane behaviour
 * would have no coverage at all: every other test file runs in FIFO mode and
 * would keep passing even if the priority path were broken.
 */

test("the flag is on for this file", () => {
  assert.equal(config.queue.priorityEngineEnabled, true);
});

test("three lanes drain in order: escalated, then critical, then by score", () => {
  const lanes = queueLane.lanesInOrder({ speciality: "General Physician" });

  assert.deepEqual(lanes.map((l) => l.name), ["ESCALATED", "CRITICAL", "NORMAL"]);
  assert.deepEqual(lanes.map((l) => l.mode), ["ESCALATED", "SCORE", "SCORE"]);
});

test("the critical lane is a separate read path, not a weight", () => {
  const [, critical] = queueLane.lanesInOrder({ speciality: "X" });
  // A predicate on emergency_level is what makes it a lane rather than a bonus.
  assert.equal(critical.where.emergencyLevel, EMERGENCY_LEVEL.CRITICAL);
  assert.equal(critical.where.status, STATUS.QUEUED);
});

test("the escalated lane is ordered first-to-breach, not by score", () => {
  const [escalated] = queueLane.lanesInOrder({ speciality: "X" });
  assert.equal(escalated.where.status, STATUS.ESCALATED);
  assert.deepEqual(escalated.order[0], ["escalatedAt", "ASC"]);
});

test("laneOf classifies by urgency and escalation", () => {
  assert.equal(
    queueLane.laneOf({ emergencyLevel: EMERGENCY_LEVEL.CRITICAL, status: STATUS.QUEUED }),
    "CRITICAL"
  );
  assert.equal(
    queueLane.laneOf({ emergencyLevel: EMERGENCY_LEVEL.LOW, status: STATUS.QUEUED }),
    "NORMAL"
  );
  assert.equal(
    queueLane.laneOf({ emergencyLevel: EMERGENCY_LEVEL.LOW, status: STATUS.ESCALATED }),
    "ESCALATED"
  );
});

test("list ordering puts the lanes ahead of the score", () => {
  const order = queueLane.listOrder();
  // Two SQL literals for the lane precedence, then score, then FIFO tie-break.
  assert.equal(order.length, 5);
  assert.ok(!Array.isArray(order[0]), "first term should be a lane literal");
  assert.ok(!Array.isArray(order[1]), "second term should be a lane literal");
  assert.deepEqual(order[2], ["priorityScore", "DESC"]);
  assert.deepEqual(order[3], ["queuedAt", "ASC"]);
  assert.deepEqual(order[4], ["id", "ASC"]);
});
