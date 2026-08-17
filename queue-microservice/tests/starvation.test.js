const test = require("node:test");
const assert = require("node:assert/strict");

const { run } = require("./helpers/queueSimulator");
const priority = require("../src/services/priority.service");
const priorityConfig = require("../src/services/priorityConfig.service");
const { CASE_TYPE, EMERGENCY_LEVEL, SPEC_MATCH } = require("../src/constants");

const cfg = priorityConfig.defaults;
const FOLLOW_UP_CAP = cfg.slaCapsMin.FOLLOW_UP; // 45
const CONSULT_MIN = 15;
const RATES = [0, 4, 12, 30, 60, 120];

const followUp = { caseType: CASE_TYPE.FOLLOW_UP, emergencyLevel: EMERGENCY_LEVEL.LOW };
const critical = { caseType: CASE_TYPE.NEW, emergencyLevel: EMERGENCY_LEVEL.CRITICAL };
const withBacklog = (n) => [followUp, ...Array.from({ length: n }, () => ({ ...critical }))];

/**
 * Priority Engine Algorithm Spec §09 — the starvation regression.
 *
 * The spec asks for: "simulate one FOLLOW_UP case sitting in queue while N
 * CRITICAL cases/hour keep arriving; assert the FOLLOW_UP case is dequeued
 * within its SLA cap (45 min) regardless of N."
 *
 * Building it revealed that the assertion as written cannot hold, for a reason
 * worth recording rather than papering over:
 *
 *   • Nothing preempts a consultation in progress, so even a case sitting at
 *     the very front waits out the current call. The tightest achievable
 *     service bound is cap + one consult cycle, not cap.
 *   • CRITICAL cases have their own 5-minute SLA cap (§05.3). Once arrivals
 *     outrun service capacity, criticals breach and escalate too — earlier than
 *     the follow-up, and ahead of it. At that point no queue discipline can
 *     serve the follow-up inside 45 minutes: the queue is growing without
 *     bound, and the answer is capacity, not ordering.
 *
 * What DOES hold regardless of N — and is the guarantee the SLA job actually
 * makes — is that the follow-up is force-promoted out of score competition
 * within one tick of its cap, no matter how heavy the critical load. That is
 * asserted first, at every arrival rate and every capacity level. The service
 * bound is then asserted separately, under the capacity condition that makes it
 * meaningful.
 */

test("a follow-up is force-promoted within one tick of its cap, regardless of N", () => {
  for (const criticalsPerHour of RATES) {
    for (const doctors of [1, 3, 12]) {
      const { byId } = run({
        seedCases: withBacklog(doctors * 3),
        criticalsPerHour,
        doctors,
        consultMin: CONSULT_MIN,
        durationMin: 180,
      });

      const entry = byId(1);
      assert.ok(
        entry.escalated || entry.assignedAtMin !== null,
        `at ${criticalsPerHour}/hr with ${doctors} doctors the follow-up was neither served nor escalated`
      );
      if (entry.escalatedAtMin !== null) {
        assert.ok(
          entry.escalatedAtMin <= FOLLOW_UP_CAP + 1,
          `at ${criticalsPerHour}/hr with ${doctors} doctors the follow-up escalated at ` +
            `${entry.escalatedAtMin} min (cap ${FOLLOW_UP_CAP})`
        );
      }
    }
  }
});

test("with capacity to serve, the follow-up is dequeued within cap + one consult", () => {
  for (const criticalsPerHour of RATES) {
    // Service rate is doctors × (60 / consultMin) per hour. Size the lane 1.5×
    // the arrival rate so the backlog drains — the condition under which a
    // service-time guarantee is meaningful at all.
    const doctors = Math.max(1, Math.ceil((criticalsPerHour / (60 / CONSULT_MIN)) * 1.5));

    const { byId } = run({
      seedCases: withBacklog(doctors * 3),
      criticalsPerHour,
      doctors,
      consultMin: CONSULT_MIN,
      durationMin: 240,
    });

    const entry = byId(1);
    assert.ok(
      entry.assignedAtMin !== null,
      `follow-up starved at ${criticalsPerHour}/hr with ${doctors} doctors`
    );
    assert.ok(
      entry.assignedAtMin <= FOLLOW_UP_CAP + CONSULT_MIN,
      `at ${criticalsPerHour}/hr with ${doctors} doctors the follow-up waited ` +
        `${entry.assignedAtMin} min (bound ${FOLLOW_UP_CAP + CONSULT_MIN})`
    );
  }
});

/**
 * The control that makes the point of §04, and the spreadsheet's original
 * "10.4 hours to catch up" finding turned into an assertion rather than tribal
 * knowledge: the aging curve alone does not save the follow-up.
 */
test("without the SLA force-promote job, aging alone lets a follow-up starve", () => {
  const { byId } = run({
    seedCases: withBacklog(3),
    criticalsPerHour: 60,
    doctors: 1,
    consultMin: CONSULT_MIN,
    durationMin: 720,
    slaEnabled: false,
  });

  const entry = byId(1);
  assert.equal(entry.escalated, false);
  assert.ok(
    entry.assignedAtMin === null || entry.assignedAtMin > 10 * 60,
    `expected starvation without the SLA job, but the follow-up was served at ${entry.assignedAtMin} min`
  );
});

/**
 * The §08 near-miss, as an assertion: even after 45 minutes of aging a
 * follow-up is still behind a same-instant new HIGH case. This is exactly why
 * the spec calls the SLA job the real guarantee and the aging curve a softer
 * pressure that usually — not always — gets there first.
 */
test("aging alone does not lift a 45-minute follow-up past a fresh HIGH case", () => {
  const aged = priority.computeScore(
    {
      emergencyLevel: EMERGENCY_LEVEL.LOW,
      caseType: CASE_TYPE.FOLLOW_UP,
      specMatch: SPEC_MATCH.EXACT,
    },
    45,
    cfg
  );
  const freshHigh = priority.computeScore(
    { emergencyLevel: EMERGENCY_LEVEL.HIGH, caseType: CASE_TYPE.NEW, specMatch: SPEC_MATCH.EXACT },
    0,
    cfg
  );

  assert.ok(
    aged.score < freshHigh.score,
    `follow-up at 45 min scored ${aged.score}, fresh HIGH scored ${freshHigh.score}`
  );
});

test("critical cases are served ahead of everything that has not breached its cap", () => {
  const { entries } = run({
    seedCases: [
      followUp,
      { caseType: CASE_TYPE.NEW, emergencyLevel: EMERGENCY_LEVEL.MEDIUM },
      { ...critical },
    ],
    criticalsPerHour: 0,
    doctors: 1,
    consultMin: CONSULT_MIN,
    durationMin: 4,
  });

  const emergency = entries.find((e) => e.emergencyLevel === EMERGENCY_LEVEL.CRITICAL);
  assert.equal(emergency.assignedAtMin, 0, "the critical case was not served first");
  for (const other of entries.filter((e) => e.id !== emergency.id)) {
    assert.ok(
      other.assignedAtMin === null || other.assignedAtMin > emergency.assignedAtMin,
      "a non-critical case was served before the critical one"
    );
  }
});
