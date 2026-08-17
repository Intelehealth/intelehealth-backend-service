const { EMERGENCY_LEVEL, EMERGENCY_RANK, CASE_TYPE, SPEC_MATCH } = require("../constants");
const priorityConfig = require("./priorityConfig.service");

/**
 * Priority Engine — the case-ranking algorithm.
 * Implements the Priority Engine Algorithm Spec §01–§04.
 *
 *   P(case, t) = w_E·E + w_C·C + w_W·W(t − queued_at) + w_S·S + V(vitals)
 *
 * Everything in this file is a pure function of its inputs and the loaded
 * config, so §09's regression tests can drive it without a database.
 *
 * ── Two deliberate deviations from the spec, both forced by the storage
 *    decision (MySQL rather than Redis sorted sets) ──────────────────────────
 *
 * 1. ε (the FIFO tie-break term) is NOT folded into the score.
 *    The spec adds ε = queued_at_epoch_ms / 1e6 as a tie-break, and §01 works
 *    through the float headroom needed to carry it inside a single Redis
 *    sorted-set score. Two problems with taking that literally: at current
 *    epoch times ε ≈ 1.79e6, which dwarfs the 3–4 digit weighted terms rather
 *    than breaking ties between them; and because higher score = more urgent,
 *    a term that grows with arrival time orders the queue LIFO, the opposite
 *    of the FIFO tie-break it is meant to provide.
 *    On MySQL none of that is necessary — ordering is `ORDER BY priority_score
 *    DESC, queued_at ASC, id ASC`, which is an exact FIFO tie-break with no
 *    precision budget to manage. The intent of §01 is preserved; the numeric
 *    packing it required is not.
 *
 * 2. The wait term is weighted, per the formal definition in §01 (w_W·W).
 *    The worked traces in §08 add W un-weighted (a 45-minute follow-up is
 *    shown as 0 + 15 + 255 + 10 = 280, i.e. W applied at full value), which
 *    contradicts §01 and §07's Σw = 1.0 rule. §01 is the normative statement
 *    and is what runs here. Note the spec itself says aging is "a softer
 *    pressure" and the SLA force-promote job in §04 is the real anti-starvation
 *    guarantee — which holds under either reading. `weights.wait` is config, so
 *    this is tunable without a code change.
 */

/**
 * W(m) — progressive aging as a closed form (§02.3).
 *
 * Piecewise-linear, continuous and strictly non-decreasing in m by
 * construction. That monotonicity IS the anti-starvation property, and it is
 * what §09's regression test checks — not the four sample points.
 *
 * With the documented tiers: W(15)=30, W(30)=105, W(45)=255, W(60)=555.
 */
const cumulativeAging = (minutes, config = priorityConfig.get()) => {
  const m = Math.max(0, Number(minutes) || 0);
  const tiers = config.agingRatesPerMin;
  let total = 0;
  let lowerBound = 0;

  for (const tier of tiers) {
    const upperBound =
      tier.upToMin === null || tier.upToMin === undefined ? Infinity : Number(tier.upToMin);
    if (m <= lowerBound) break;
    total += (Math.min(m, upperBound) - lowerBound) * Number(tier.rate);
    if (m <= upperBound) break;
    lowerBound = upperBound;
  }

  return total;
};

/**
 * V(vitals) — additive, never first-match (§02.5).
 * "A patient with SpO2 88% and pulse 128 is worse than either alone, and the
 * score should reflect both."
 *
 * Accepts { spo2, systolicBp | bp, pulse, tempF | temp }.
 */
const vitalsBonus = (vitals, config = priorityConfig.get()) => {
  if (!vitals || typeof vitals !== "object") return 0;
  const v = config.vitals;
  let total = 0;

  const spo2 = Number(vitals.spo2 ?? vitals.spO2 ?? vitals.oxygen);
  if (Number.isFinite(spo2) && spo2 < v.spo2.below) total += v.spo2.points;

  const systolic = Number(vitals.systolicBp ?? vitals.bp ?? vitals.systolic);
  if (Number.isFinite(systolic) && systolic > v.bp.above) total += v.bp.points;

  const pulse = Number(vitals.pulse ?? vitals.heartRate);
  if (Number.isFinite(pulse) && pulse > v.pulse.above) total += v.pulse.points;

  const temp = Number(vitals.tempF ?? vitals.temperature ?? vitals.temp);
  if (Number.isFinite(temp) && temp > v.tempF.above) total += v.tempF.points;

  return total;
};

/**
 * Emergency level after the floors are applied (§00, §02.1).
 *
 * A type-15 "Flagged" encounter already exists in production as a manual
 * escalation signal — doctors and CHWs already know how to set it. It acts as
 * a FLOOR (default HIGH), not a competitor: a flagged visit scores at least
 * HIGH even with no other signal, and vitals-based auto-escalation layers on
 * top rather than replacing it.
 */
const resolveEmergencyLevel = ({ emergencyLevel, flagged, vitalsPoints = 0 }, config = priorityConfig.get()) => {
  let level = Object.values(EMERGENCY_LEVEL).includes(emergencyLevel)
    ? emergencyLevel
    : EMERGENCY_LEVEL.LOW;

  if (flagged) {
    const floor = config.flaggedEmergencyFloor || EMERGENCY_LEVEL.HIGH;
    if (EMERGENCY_RANK[level] < EMERGENCY_RANK[floor]) level = floor;
  }

  const criticalAt = config.vitals?.criticalEscalationAt;
  if (Number.isFinite(criticalAt) && vitalsPoints >= criticalAt) {
    if (EMERGENCY_RANK[level] < EMERGENCY_RANK[EMERGENCY_LEVEL.CRITICAL]) {
      level = EMERGENCY_LEVEL.CRITICAL;
    }
  }

  return level;
};

/**
 * The score with the wait term at zero: w_E·E + w_C·C + w_S·S + V.
 * Stored as `base_score` so the aging job only ever moves the wait term.
 */
const computeBaseScore = (input, config = priorityConfig.get()) => {
  const vitalsPoints = vitalsBonus(input.vitals, config);
  const emergencyLevel = resolveEmergencyLevel(
    { emergencyLevel: input.emergencyLevel, flagged: input.flagged, vitalsPoints },
    config
  );
  const caseType = Object.values(CASE_TYPE).includes(input.caseType) ? input.caseType : CASE_TYPE.NEW;
  const specMatch = Object.values(SPEC_MATCH).includes(input.specMatch)
    ? input.specMatch
    : SPEC_MATCH.EXACT;

  const w = config.weights;
  const components = {
    emergency: w.emergency * config.emergencyValues[emergencyLevel],
    caseType: w.caseType * config.caseTypeValues[caseType],
    spec: w.spec * config.specMatchValues[specMatch],
    vitals: vitalsPoints,
  };

  return {
    emergencyLevel,
    caseType,
    specMatch,
    vitalsPoints,
    components,
    baseScore:
      components.emergency + components.caseType + components.spec + components.vitals,
  };
};

/** The weighted wait term, w_W·W(m). */
const waitTerm = (minutesWaited, config = priorityConfig.get()) =>
  config.weights.wait * cumulativeAging(minutesWaited, config);

/** Full P(case, t) for a fresh case or a simulation. */
const computeScore = (input, minutesWaited = 0, config = priorityConfig.get()) => {
  const base = computeBaseScore(input, config);
  const wait = waitTerm(minutesWaited, config);
  return { ...base, waitTerm: wait, score: base.baseScore + wait };
};

/**
 * Minutes a case has been waiting. Measured from queued_at, falling back to
 * created_at for a case still in SUBMITTED.
 */
const minutesWaited = (entry, now = new Date()) => {
  const start = entry.queuedAt || entry.createdAt;
  if (!start) return 0;
  return Math.max(0, (now.getTime() - new Date(start).getTime()) / 60000);
};

/**
 * The aging job's delta (§03).
 *
 * Recomputes the total bonus due from the closed form and applies only the
 * difference against what has already been applied. Idempotent regardless of
 * how irregularly the job actually runs: a missed tick, a restart, or a tick
 * that straddles a tier boundary all converge to the same W(m), because the
 * delta is always computed from absolute elapsed time rather than from "the
 * current tier's rate since last time".
 *
 * The cadence is therefore a performance knob, not a correctness dependency.
 */
const agingDelta = (entry, now = new Date(), config = priorityConfig.get()) => {
  const waited = minutesWaited(entry, now);
  const totalDue = waitTerm(waited, config);
  const applied = Number(entry.cumulativeAgingApplied || 0);
  return { waitedMinutes: waited, totalDue, delta: totalDue - applied };
};

/**
 * Backend LLD §05.3 — hard maximum wait before force-promotion, by case type
 * and emergency level.
 */
const slaCapMinutes = (caseType, emergencyLevel, config = priorityConfig.get()) => {
  const caps = config.slaCapsMin;
  if (caseType === CASE_TYPE.REFERRAL) return caps.REFERRAL;
  if (caseType === CASE_TYPE.FOLLOW_UP) return caps.FOLLOW_UP;
  if (emergencyLevel === EMERGENCY_LEVEL.CRITICAL) return caps.NEW_CRITICAL;
  if (emergencyLevel === EMERGENCY_LEVEL.HIGH) return caps.NEW_HIGH;
  return caps.NEW_OTHER;
};

const isPastSlaCap = (entry, now = new Date(), config = priorityConfig.get()) =>
  minutesWaited(entry, now) > slaCapMinutes(entry.caseType, entry.emergencyLevel, config);

module.exports = {
  cumulativeAging,
  vitalsBonus,
  resolveEmergencyLevel,
  computeBaseScore,
  waitTerm,
  computeScore,
  minutesWaited,
  agingDelta,
  slaCapMinutes,
  isPastSlaCap,
};
