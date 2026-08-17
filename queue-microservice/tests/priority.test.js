const test = require("node:test");
const assert = require("node:assert/strict");

const priority = require("../src/services/priority.service");
const priorityConfig = require("../src/services/priorityConfig.service");
const { EMERGENCY_LEVEL, CASE_TYPE, SPEC_MATCH } = require("../src/constants");

const cfg = priorityConfig.defaults;

test("W(m) matches the closed form in Priority Engine §02.3", () => {
  // The four boundaries the spec derives from the LLD's per-5-minute tiers.
  assert.equal(priority.cumulativeAging(0, cfg), 0);
  assert.equal(priority.cumulativeAging(15, cfg), 30); // 15 × 2
  assert.equal(priority.cumulativeAging(30, cfg), 105); // 30 + 15 × 5
  assert.equal(priority.cumulativeAging(45, cfg), 255); // 105 + 15 × 10
  assert.equal(priority.cumulativeAging(60, cfg), 555); // 255 + 15 × 20

  // Mid-tier interpolation — the point of expressing it as a closed form.
  assert.equal(priority.cumulativeAging(7.5, cfg), 15);
  assert.equal(priority.cumulativeAging(22.5, cfg), 67.5);
});

test("W is continuous and strictly non-decreasing — the anti-starvation property", () => {
  // §02.3: "that monotonicity is the actual anti-starvation guarantee, and it's
  // what §09's regression test checks directly, not just the four sample
  // points from the spreadsheet."
  let previous = -Infinity;
  for (let m = 0; m <= 600; m += 0.25) {
    const value = priority.cumulativeAging(m, cfg);
    assert.ok(value >= previous, `W(${m}) = ${value} decreased from ${previous}`);
    previous = value;
  }

  // Continuity at every tier boundary: no jump discontinuities.
  for (const boundary of [15, 30, 45]) {
    const before = priority.cumulativeAging(boundary - 1e-6, cfg);
    const after = priority.cumulativeAging(boundary + 1e-6, cfg);
    assert.ok(Math.abs(after - before) < 1e-3, `W jumps at m=${boundary}`);
  }
});

test("P never decreases as a case waits — §09 monotonicity invariant", () => {
  const input = {
    emergencyLevel: EMERGENCY_LEVEL.LOW,
    caseType: CASE_TYPE.FOLLOW_UP,
    specMatch: SPEC_MATCH.EXACT,
  };
  let previous = -Infinity;
  for (let m = 0; m <= 600; m += 1) {
    const { score } = priority.computeScore(input, m, cfg);
    assert.ok(score >= previous, `P decreased at m=${m}`);
    previous = score;
  }
});

test("V sums every threshold crossed rather than taking the first match (§02.5)", () => {
  // "A patient with SpO2 88% and pulse 128 is worse than either alone."
  assert.equal(priority.vitalsBonus({ spo2: 88 }, cfg), 300);
  assert.equal(priority.vitalsBonus({ pulse: 128 }, cfg), 150);
  assert.equal(priority.vitalsBonus({ spo2: 88, pulse: 128 }, cfg), 450);

  // All four together.
  assert.equal(
    priority.vitalsBonus({ spo2: 85, systolicBp: 200, pulse: 130, tempF: 104 }, cfg),
    750
  );

  // Boundaries are exclusive exactly as written: SpO2 < 90, BP > 180.
  assert.equal(priority.vitalsBonus({ spo2: 90 }, cfg), 0);
  assert.equal(priority.vitalsBonus({ systolicBp: 180 }, cfg), 0);
  assert.equal(priority.vitalsBonus({ systolicBp: 181 }, cfg), 200);

  // Missing or malformed vitals must never throw or invent points.
  assert.equal(priority.vitalsBonus(null, cfg), 0);
  assert.equal(priority.vitalsBonus({ spo2: "not a number" }, cfg), 0);
});

test("a flagged (type-15) visit floors at HIGH without displacing a higher level", () => {
  // §00: "a flagged visit should score at least HIGH even with no other signal
  // ... a floor, not a competitor."
  assert.equal(
    priority.resolveEmergencyLevel({ emergencyLevel: EMERGENCY_LEVEL.LOW, flagged: true }, cfg),
    EMERGENCY_LEVEL.HIGH
  );
  assert.equal(
    priority.resolveEmergencyLevel({ emergencyLevel: EMERGENCY_LEVEL.MEDIUM, flagged: true }, cfg),
    EMERGENCY_LEVEL.HIGH
  );
  // Already CRITICAL — the floor must not pull it down.
  assert.equal(
    priority.resolveEmergencyLevel({ emergencyLevel: EMERGENCY_LEVEL.CRITICAL, flagged: true }, cfg),
    EMERGENCY_LEVEL.CRITICAL
  );
  // Not flagged, no vitals — unchanged.
  assert.equal(
    priority.resolveEmergencyLevel({ emergencyLevel: EMERGENCY_LEVEL.LOW, flagged: false }, cfg),
    EMERGENCY_LEVEL.LOW
  );
});

test("vitals auto-escalation layers on top of the flagged floor (§02.1)", () => {
  const level = priority.resolveEmergencyLevel(
    { emergencyLevel: EMERGENCY_LEVEL.LOW, flagged: true, vitalsPoints: 300 },
    cfg
  );
  assert.equal(level, EMERGENCY_LEVEL.CRITICAL);
});

test("relative ordering: a new critical outranks a fresh follow-up by a wide margin", () => {
  const critical = priority.computeScore(
    {
      emergencyLevel: EMERGENCY_LEVEL.CRITICAL,
      caseType: CASE_TYPE.NEW,
      specMatch: SPEC_MATCH.EXACT,
      vitals: { spo2: 88 },
    },
    0,
    cfg
  );
  const followUp = priority.computeScore(
    {
      emergencyLevel: EMERGENCY_LEVEL.LOW,
      caseType: CASE_TYPE.FOLLOW_UP,
      specMatch: SPEC_MATCH.EXACT,
    },
    0,
    cfg
  );

  // The §08 worked trace: 400 + 90 + 0 + 10 + 300 = 800, and 0 + 15 + 0 + 10 = 25.
  assert.equal(critical.score, 800);
  assert.equal(followUp.score, 25);
  assert.ok(critical.score > followUp.score);
});

test("referrals are re-prioritised above follow-ups, below new cases", () => {
  const score = (caseType) =>
    priority.computeScore(
      { emergencyLevel: EMERGENCY_LEVEL.LOW, caseType, specMatch: SPEC_MATCH.EXACT },
      0,
      cfg
    ).score;

  assert.ok(score(CASE_TYPE.NEW) > score(CASE_TYPE.REFERRAL));
  assert.ok(score(CASE_TYPE.REFERRAL) > score(CASE_TYPE.FOLLOW_UP));
});

test("SLA caps resolve per the §05.3 table", () => {
  assert.equal(priority.slaCapMinutes(CASE_TYPE.NEW, EMERGENCY_LEVEL.CRITICAL, cfg), 5);
  assert.equal(priority.slaCapMinutes(CASE_TYPE.NEW, EMERGENCY_LEVEL.HIGH, cfg), 10);
  assert.equal(priority.slaCapMinutes(CASE_TYPE.NEW, EMERGENCY_LEVEL.MEDIUM, cfg), 30);
  assert.equal(priority.slaCapMinutes(CASE_TYPE.NEW, EMERGENCY_LEVEL.LOW, cfg), 30);
  // Case type wins over emergency level for referrals and follow-ups.
  assert.equal(priority.slaCapMinutes(CASE_TYPE.REFERRAL, EMERGENCY_LEVEL.CRITICAL, cfg), 20);
  assert.equal(priority.slaCapMinutes(CASE_TYPE.FOLLOW_UP, EMERGENCY_LEVEL.HIGH, cfg), 45);
});
