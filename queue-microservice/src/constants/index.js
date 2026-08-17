/**
 * Shared enums. Backend LLD §02 (data model) and §04 (case lifecycle).
 */

// LLD §04 — case lifecycle. ESCALATED is the state added for the starvation
// SLA force-promote (§05.3).
const STATUS = {
  SUBMITTED: "SUBMITTED",
  QUEUED: "QUEUED",
  ESCALATED: "ESCALATED",
  ASSIGNED: "ASSIGNED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  RE_QUEUED: "RE_QUEUED",
};

/** Statuses that occupy a place in the line and are eligible to be claimed. */
const WAITING_STATUSES = [STATUS.QUEUED, STATUS.ESCALATED];

/** Statuses where a doctor is actively occupied by the case. */
const IN_SERVICE_STATUSES = [STATUS.ASSIGNED, STATUS.CONNECTING, STATUS.CONNECTED];

const TERMINAL_STATUSES = [STATUS.COMPLETED, STATUS.CANCELLED];

const EMERGENCY_LEVEL = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

/** Ascending urgency — used for "floor" comparisons (Priority spec §00). */
const EMERGENCY_RANK = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const CASE_TYPE = {
  NEW: "NEW",
  REFERRAL: "REFERRAL",
  FOLLOW_UP: "FOLLOW_UP",
};

const SPEC_MATCH = {
  EXACT: "EXACT",
  GENERAL: "GENERAL",
  NONE: "NONE",
};

const DOCTOR_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  IN_CONSULT: "in_consult",
  AWAY: "away",
};

/** LLD §07 — A = speciality-pooled, B = doctor-level. */
const ETA_MODEL = { A: "A", B: "B" };

/** LLD §08 — notification tiers by queue position. */
const NOTIFICATION_TIER = {
  IMMEDIATE: "IMMEDIATE", // positions 1-3
  DEBOUNCED: "DEBOUNCED", // positions 4-10
  BATCHED: "BATCHED", // positions 11-30
  PULL: "PULL", // positions 31+
};

const GENERAL_SPECIALITIES = ["general physician", "general", "gp"];

module.exports = {
  STATUS,
  WAITING_STATUSES,
  IN_SERVICE_STATUSES,
  TERMINAL_STATUSES,
  EMERGENCY_LEVEL,
  EMERGENCY_RANK,
  CASE_TYPE,
  SPEC_MATCH,
  DOCTOR_STATUS,
  ETA_MODEL,
  NOTIFICATION_TIER,
  GENERAL_SPECIALITIES,
};
