const defaults = require("../config/priority.default");
const logger = require("../utils/logger");
const { BadRequestError } = require("../utils/errors");
const { EMERGENCY_LEVEL, CASE_TYPE, SPEC_MATCH } = require("../constants");

/**
 * Priority Engine Algorithm Spec §07 — configuration & tunability.
 *
 * Weights, aging rates, SLA caps and vitals thresholds are config, not
 * constants. Stored as one JSON column in `priority_config`, loaded into memory
 * at startup, re-read when an admin updates it.
 *
 * "Loader rejects the config outright if Σweights ≠ 1.0 (within float
 * tolerance) — fail closed at startup, not silently miscalibrated in
 * production."
 */
const WEIGHT_TOLERANCE = 1e-6;

let cached = null;

const deepMerge = (base, override) => {
  if (!override || typeof override !== "object" || Array.isArray(override)) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof out[key] === "object") {
      out[key] = deepMerge(out[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
};

const sum = (obj) => Object.values(obj).reduce((acc, n) => acc + Number(n || 0), 0);

/**
 * Fail-closed validation. Throws rather than falling back — a miscalibrated
 * ranking algorithm running silently is the outcome §07 exists to prevent.
 */
const validate = (config) => {
  const problems = [];

  if (!config || typeof config !== "object") {
    throw new BadRequestError("Priority config must be an object", "INVALID_PRIORITY_CONFIG");
  }

  // §01 / §07 — Σw = 1.0, enforced.
  const w = config.weights || {};
  for (const key of ["emergency", "caseType", "wait", "spec"]) {
    if (!Number.isFinite(Number(w[key]))) problems.push(`weights.${key} must be a number`);
    else if (Number(w[key]) < 0) problems.push(`weights.${key} must not be negative`);
  }
  const total = sum(w);
  if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
    problems.push(`weights must sum to 1.0 (got ${total})`);
  }

  for (const level of Object.values(EMERGENCY_LEVEL)) {
    if (!Number.isFinite(Number(config.emergencyValues?.[level]))) {
      problems.push(`emergencyValues.${level} must be a number`);
    }
  }
  for (const type of Object.values(CASE_TYPE)) {
    if (!Number.isFinite(Number(config.caseTypeValues?.[type]))) {
      problems.push(`caseTypeValues.${type} must be a number`);
    }
  }
  for (const match of Object.values(SPEC_MATCH)) {
    if (!Number.isFinite(Number(config.specMatchValues?.[match]))) {
      problems.push(`specMatchValues.${match} must be a number`);
    }
  }

  // §02.3 — W must stay continuous and strictly non-decreasing: rates cannot be
  // negative, tier boundaries must ascend, and the last tier must be open-ended
  // so W grows without bound past the final boundary.
  const tiers = config.agingRatesPerMin;
  if (!Array.isArray(tiers) || tiers.length === 0) {
    problems.push("agingRatesPerMin must be a non-empty array");
  } else {
    let previous = 0;
    tiers.forEach((tier, index) => {
      const isLast = index === tiers.length - 1;
      if (!Number.isFinite(Number(tier?.rate)) || Number(tier.rate) < 0) {
        problems.push(`agingRatesPerMin[${index}].rate must be a non-negative number`);
      }
      if (isLast) {
        if (tier?.upToMin !== null && tier?.upToMin !== undefined) {
          problems.push("the last agingRatesPerMin tier must have upToMin: null (open-ended)");
        }
        return;
      }
      const upTo = Number(tier?.upToMin);
      if (!Number.isFinite(upTo) || upTo <= previous) {
        problems.push(`agingRatesPerMin[${index}].upToMin must ascend (got ${tier?.upToMin})`);
      }
      previous = upTo;
    });
  }

  for (const [key, value] of Object.entries(config.slaCapsMin || {})) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
      problems.push(`slaCapsMin.${key} must be a positive number of minutes`);
    }
  }
  for (const key of ["NEW_CRITICAL", "NEW_HIGH", "NEW_OTHER", "REFERRAL", "FOLLOW_UP"]) {
    if (config.slaCapsMin?.[key] === undefined) problems.push(`slaCapsMin.${key} is required`);
  }

  const dw = config.doctorAssignment?.weights || {};
  const dwTotal = sum(dw);
  if (Math.abs(dwTotal - 1) > WEIGHT_TOLERANCE) {
    problems.push(`doctorAssignment.weights must sum to 1.0 (got ${dwTotal})`);
  }

  if (
    config.flaggedEmergencyFloor &&
    !Object.values(EMERGENCY_LEVEL).includes(config.flaggedEmergencyFloor)
  ) {
    problems.push("flaggedEmergencyFloor must be a valid emergency level");
  }

  if (problems.length) {
    throw new BadRequestError(
      "Priority config rejected — fail closed (Priority Engine spec §07)",
      "INVALID_PRIORITY_CONFIG",
      { problems }
    );
  }

  return config;
};

/** Synchronous read of the in-memory copy. Falls back to defaults pre-load. */
const get = () => cached || defaults;

/**
 * Reads the newest active row and validates it. Throws on an invalid stored
 * config: the service must not boot miscalibrated.
 */
const load = async (models) => {
  let stored = null;
  try {
    const row = await models.priority_config.findOne({
      where: { isActive: true },
      order: [["id", "DESC"]],
    });
    stored = row?.config || null;
  } catch (err) {
    // Table missing (migrations not run yet) — boot on documented defaults
    // rather than refusing to start, but say so loudly.
    logger.warn("priority_config unreadable, using documented defaults", { error: err.message });
    cached = validate(deepMerge({}, defaults));
    return cached;
  }

  const merged = stored ? deepMerge(defaults, typeof stored === "string" ? JSON.parse(stored) : stored) : deepMerge({}, defaults);
  cached = validate(merged);
  logger.info("Priority config loaded", {
    source: stored ? "priority_config table" : "defaults",
    weights: cached.weights,
  });
  return cached;
};

/** Admin update: validate first, then persist, then swap the in-memory copy. */
const update = async (models, patch, { updatedBy = null, note = null } = {}) => {
  const merged = validate(deepMerge(get(), patch));
  await models.sequelize.transaction(async (t) => {
    await models.priority_config.update(
      { isActive: false },
      { where: { isActive: true }, transaction: t }
    );
    await models.priority_config.create(
      { config: merged, isActive: true, updatedBy, note },
      { transaction: t }
    );
  });
  cached = merged;
  logger.info("Priority config updated", { updatedBy, note });
  return cached;
};

/** Test hook. */
const setForTesting = (config) => {
  cached = config ? validate(deepMerge(defaults, config)) : null;
  return cached;
};

module.exports = { get, load, update, validate, defaults, setForTesting, deepMerge };
