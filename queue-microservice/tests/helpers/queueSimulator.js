const priority = require("../../src/services/priority.service");
const priorityConfig = require("../../src/services/priorityConfig.service");
const { EMERGENCY_LEVEL, CASE_TYPE, SPEC_MATCH } = require("../../src/constants");

/**
 * An in-memory model of the queue, used by the validation tests required by
 * Priority Engine Algorithm Spec §09.
 *
 * It mirrors the production rules exactly — the same score function, the same
 * closed-form aging, the same three-lane drain order, the same escalate-once
 * SLA job — but without a database, so the tests run anywhere and the
 * arithmetic is what is under test rather than Sequelize.
 */
const MINUTE = 60000;

const makeCase = (id, { caseType, emergencyLevel, vitals, flagged, queuedAtMin = 0 }, cfg) => {
  const scored = priority.computeBaseScore(
    { emergencyLevel, caseType, specMatch: SPEC_MATCH.EXACT, vitals, flagged },
    cfg
  );
  return {
    id,
    caseType: scored.caseType,
    emergencyLevel: scored.emergencyLevel,
    baseScore: scored.baseScore,
    priorityScore: scored.baseScore,
    cumulativeAgingApplied: 0,
    queuedAtMin,
    escalated: false,
    escalatedAtMin: null,
    status: "QUEUED",
    assignedAtMin: null,
  };
};

/** The production aging job's arithmetic, minute-based. (§03) */
const applyAging = (entry, nowMin, cfg) => {
  if (entry.status !== "QUEUED" && entry.status !== "ESCALATED") return 0;
  const waited = Math.max(0, nowMin - entry.queuedAtMin);
  const totalDue = priority.waitTerm(waited, cfg);
  const delta = totalDue - entry.cumulativeAgingApplied;
  if (!(delta > 0)) return 0;
  entry.priorityScore = entry.baseScore + totalDue;
  entry.cumulativeAgingApplied = totalDue;
  return delta;
};

/** The production SLA force-promote job. (§04) */
const applySla = (entries, nowMin, cfg) => {
  const promoted = [];
  for (const entry of entries) {
    if (entry.status !== "QUEUED") continue;
    if (entry.escalated) continue; // escalate once
    const waited = nowMin - entry.queuedAtMin;
    const cap = priority.slaCapMinutes(entry.caseType, entry.emergencyLevel, cfg);
    if (waited <= cap) continue;

    const lanePeers = entries.filter(
      (e) => e.status === "QUEUED" && (e.emergencyLevel === EMERGENCY_LEVEL.CRITICAL) === (entry.emergencyLevel === EMERGENCY_LEVEL.CRITICAL)
    );
    const top = lanePeers.reduce((max, e) => Math.max(max, e.priorityScore), 0);

    entry.priorityScore = top + 1;
    entry.baseScore = entry.priorityScore - entry.cumulativeAgingApplied;
    entry.status = "ESCALATED";
    entry.escalated = true;
    entry.escalatedAtMin = nowMin;
    promoted.push(entry);
  }
  return promoted;
};

/** The three-lane drain order from queueLane.service.js. */
const nextCase = (entries, { escalationOutranksCritical = true } = {}) => {
  const waiting = entries.filter((e) => e.status === "QUEUED" || e.status === "ESCALATED");

  const escalated = waiting
    .filter((e) => e.status === "ESCALATED")
    .sort((a, b) => a.escalatedAtMin - b.escalatedAtMin || b.priorityScore - a.priorityScore || a.id - b.id);
  const critical = waiting
    .filter((e) => e.status === "QUEUED" && e.emergencyLevel === EMERGENCY_LEVEL.CRITICAL)
    .sort((a, b) => b.priorityScore - a.priorityScore || a.queuedAtMin - b.queuedAtMin || a.id - b.id);
  const normal = waiting
    .filter((e) => e.status === "QUEUED" && e.emergencyLevel !== EMERGENCY_LEVEL.CRITICAL)
    .sort((a, b) => b.priorityScore - a.priorityScore || a.queuedAtMin - b.queuedAtMin || a.id - b.id);

  const lanes = escalationOutranksCritical
    ? [escalated, critical, normal]
    : [critical, escalated, normal];

  for (const lane of lanes) if (lane.length) return lane[0];
  return null;
};

/**
 * Run the queue for `durationMin`, one minute at a time.
 *
 * @param options.criticalsPerHour  arrival rate of CRITICAL cases
 * @param options.doctors           how many doctors serve the lane
 * @param options.consultMin        how long each consultation takes
 * @param options.slaEnabled        turn the §04 job off to show what it buys
 */
const run = ({
  seedCases = [],
  criticalsPerHour = 12,
  doctors = 1,
  consultMin = 15,
  durationMin = 720,
  slaEnabled = true,
  escalationOutranksCritical = true,
  cfg = priorityConfig.defaults,
} = {}) => {
  const entries = seedCases.map((spec, i) => makeCase(i + 1, spec, cfg));
  let nextId = entries.length + 1;

  const busyUntil = new Array(doctors).fill(0);
  const arrivalGap = criticalsPerHour > 0 ? 60 / criticalsPerHour : Infinity;
  // The first critical lands at minute 0, alongside the seeded cases — a queue
  // that only starts filling a minute later would let the seeded follow-up be
  // served before the pressure this simulation exists to model ever arrives.
  let nextArrival = criticalsPerHour > 0 ? 0 : Infinity;

  for (let minute = 0; minute <= durationMin; minute += 1) {
    while (minute >= nextArrival) {
      entries.push(
        makeCase(
          nextId++,
          {
            caseType: CASE_TYPE.NEW,
            emergencyLevel: EMERGENCY_LEVEL.CRITICAL,
            queuedAtMin: minute,
          },
          cfg
        )
      );
      nextArrival += arrivalGap;
    }

    for (const entry of entries) applyAging(entry, minute, cfg);
    if (slaEnabled) applySla(entries, minute, cfg);

    for (let d = 0; d < doctors; d += 1) {
      if (busyUntil[d] > minute) continue;
      const picked = nextCase(entries, { escalationOutranksCritical });
      if (!picked) continue;
      picked.status = "ASSIGNED";
      picked.assignedAtMin = minute;
      busyUntil[d] = minute + consultMin;
    }
  }

  return { entries, byId: (id) => entries.find((e) => e.id === id) };
};

module.exports = { MINUTE, makeCase, applyAging, applySla, nextCase, run };
