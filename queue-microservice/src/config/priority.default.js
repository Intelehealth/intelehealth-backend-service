/**
 * Default Priority Engine configuration.
 *
 * Priority Engine Algorithm Spec §07: weights, aging rates, SLA caps and vitals
 * thresholds are configuration, not constants. The live copy lives in the
 * `priority_config` table (one JSON column, loaded into memory at startup and
 * re-read when an admin updates it). This object is the fallback used when the
 * table is empty, and the shape every stored config is validated against.
 *
 * EVERY NUMBER HERE IS A DEFAULT AWAITING CLINICAL SIGN-OFF — Priority Engine
 * spec §00 is explicit that the point values came from one worked example and
 * that nobody clinical has confirmed them. Treat them like a paper triage
 * protocol: get them signed off before this runs on real patients.
 */
module.exports = {
  // §01 — Σw must equal 1.0. Enforced at load time (fail closed, §07).
  weights: {
    emergency: 0.4,
    caseType: 0.3,
    wait: 0.2,
    spec: 0.1,
  },

  // §02.1 — E
  emergencyValues: {
    CRITICAL: 1000,
    HIGH: 500,
    MEDIUM: 100,
    LOW: 0,
  },

  // §02.2 — C
  caseTypeValues: {
    NEW: 300,
    REFERRAL: 200,
    FOLLOW_UP: 50,
  },

  // §02.4 — S
  specMatchValues: {
    EXACT: 100,
    GENERAL: 50,
    NONE: 0,
  },

  // §02.3 — progressive aging as a closed form. Rates are points per MINUTE;
  // the tiers below are the per-5-minute tiers from backend LLD §05.2 restated
  // per-minute so the curve is continuous and a missed job tick cannot
  // under-age a case.
  agingRatesPerMin: [
    { upToMin: 15, rate: 2 }, // = 10 pts / 5 min
    { upToMin: 30, rate: 5 }, // = 25 pts / 5 min
    { upToMin: 45, rate: 10 }, // = 50 pts / 5 min
    { upToMin: null, rate: 20 }, // = 100 pts / 5 min
  ],

  // §02.5 — V. Additive: sum every threshold independently crossed, never
  // first-match. A patient with SpO2 88 and pulse 128 is worse than either.
  vitals: {
    spo2: { below: 90, points: 300 },
    bp: { above: 180, points: 200 }, // systolic
    pulse: { above: 120, points: 150 },
    tempF: { above: 103, points: 100 },
    // Total vitals points at or above this auto-escalate emergency_level to
    // CRITICAL (§02.1 "vitals auto-escalation reaching CRITICAL threshold" —
    // the spec names the mechanism but not the number; 300 = SpO2 < 90 alone).
    criticalEscalationAt: 300,
  },

  // §00 — a manual priority flag already exists in production: a type-15
  // "Flagged" encounter. Treat it as a floor, not a competitor.
  flaggedEmergencyFloor: "HIGH",

  // Backend LLD §05.3 — hard maximum wait before force-promotion, independent
  // of score. This, not the aging curve, is the real anti-starvation guarantee.
  slaCapsMin: {
    NEW_CRITICAL: 5,
    NEW_HIGH: 10,
    NEW_OTHER: 30,
    REFERRAL: 20,
    FOLLOW_UP: 45,
  },

  // Backend LLD §06 — doctor assignment scoring.
  doctorAssignment: {
    weights: {
      queueLoad: 0.4,
      specMatch: 0.3,
      efficiency: 0.2,
      rating: 0.1,
    },
    specMatchValues: { EXACT: 100, GENERAL: 70, OTHER: 30 },
  },
};
