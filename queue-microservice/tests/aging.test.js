const test = require("node:test");
const assert = require("node:assert/strict");

const priority = require("../src/services/priority.service");
const priorityConfig = require("../src/services/priorityConfig.service");
const { applyAging } = require("./helpers/queueSimulator");
const { CASE_TYPE, EMERGENCY_LEVEL, SPEC_MATCH } = require("../src/constants");

const cfg = priorityConfig.defaults;

const freshCase = () => {
  const scored = priority.computeBaseScore(
    {
      emergencyLevel: EMERGENCY_LEVEL.LOW,
      caseType: CASE_TYPE.FOLLOW_UP,
      specMatch: SPEC_MATCH.EXACT,
    },
    cfg
  );
  return {
    id: 1,
    caseType: scored.caseType,
    emergencyLevel: scored.emergencyLevel,
    baseScore: scored.baseScore,
    priorityScore: scored.baseScore,
    cumulativeAgingApplied: 0,
    queuedAtMin: 0,
    status: "QUEUED",
  };
};

/**
 * Priority Engine Algorithm Spec §09 — "idempotent-tick property".
 *
 * "Run the aging job with a randomized, irregular tick schedule (simulating
 * restarts/drift) against a fixed elapsed time; assert cumulativeAgingApplied
 * converges to the same W(m) regardless of how many ticks it took to get
 * there."
 */
test("aging converges to the same W(m) no matter how irregular the tick schedule is", () => {
  const elapsed = 97; // minutes — deliberately past every tier boundary
  const expected = priority.waitTerm(elapsed, cfg);

  const schedules = [
    [elapsed], // one single tick, as if the job only ever ran once
    Array.from({ length: elapsed }, (_, i) => i + 1), // every minute
    [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, elapsed],
    [3, 3, 14, 14, 44, 46, 46, 61, 90, elapsed], // stalls, repeats, boundary straddles
    [46, 12, 90, 30, elapsed], // out of order, as a restart replaying stale state
  ];

  for (const schedule of schedules) {
    const entry = freshCase();
    for (const minute of schedule) applyAging(entry, minute, cfg);

    assert.ok(
      Math.abs(entry.cumulativeAgingApplied - expected) < 1e-9,
      `schedule ${JSON.stringify(schedule)} produced ${entry.cumulativeAgingApplied}, expected ${expected}`
    );
    assert.ok(Math.abs(entry.priorityScore - (entry.baseScore + expected)) < 1e-9);
  }
});

test("a repeated tick at the same instant applies nothing twice", () => {
  const entry = freshCase();
  const first = applyAging(entry, 20, cfg);
  const second = applyAging(entry, 20, cfg);
  const third = applyAging(entry, 20, cfg);

  assert.ok(first > 0);
  assert.equal(second, 0);
  assert.equal(third, 0);
  assert.ok(Math.abs(entry.cumulativeAgingApplied - priority.waitTerm(20, cfg)) < 1e-9);
});

test("a tick that straddles a tier boundary applies the correct total, not one tier's rate", () => {
  // 14 → 46 crosses two boundaries. A naive "current tier rate × elapsed" would
  // charge 32 minutes at the 30-45 tier and get this wrong in both directions.
  const entry = freshCase();
  applyAging(entry, 14, cfg);
  applyAging(entry, 46, cfg);

  assert.ok(Math.abs(entry.cumulativeAgingApplied - priority.waitTerm(46, cfg)) < 1e-9);
});

/**
 * Priority Engine Algorithm Spec §09 — "no-resurrection property".
 *
 * "Claim a case concurrently with an in-flight aging tick for that same case;
 * assert it does not reappear in the sorted set."
 *
 * On Redis this needed an explicit status check, because ZINCRBY against a
 * member that no longer exists silently re-creates it. On MySQL the guard is
 * the UPDATE's own WHERE clause — this test models that clause and asserts a
 * claimed case is untouched by a tick that was already in flight.
 */
test("an aging tick cannot resurrect a case claimed since the snapshot", () => {
  const entry = freshCase();

  // The job reads its batch...
  const snapshot = { ...entry };
  assert.equal(snapshot.status, "QUEUED");

  // ...a doctor claims the case in the gap...
  entry.status = "ASSIGNED";

  // ...and the tick lands. The status guard is what makes this a no-op.
  const delta = applyAging(entry, 40, cfg);

  assert.equal(delta, 0);
  assert.equal(entry.status, "ASSIGNED");
  assert.equal(entry.cumulativeAgingApplied, 0);
  assert.equal(entry.priorityScore, snapshot.priorityScore);
});

test("an escalated case still ages — it is waiting, not gone", () => {
  const entry = freshCase();
  entry.status = "ESCALATED";
  const delta = applyAging(entry, 50, cfg);
  assert.ok(delta > 0);
});

test("a cancelled case never ages", () => {
  const entry = freshCase();
  entry.status = "CANCELLED";
  assert.equal(applyAging(entry, 120, cfg), 0);
});
