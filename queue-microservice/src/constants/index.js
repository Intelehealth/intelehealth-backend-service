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
  CALL_CONNECTING: "CALL_CONNECTING",
  CALL_CONNECTED: "CALL_CONNECTED",
  // The call is over but the visit is not: the doctor still owes a
  // prescription. A consultation is only finished when that is shared.
  CALL_COMPLETED: "CALL_COMPLETED",
  // The only successful ending. There is no "COMPLETED" short of a shared
  // prescription — that is the whole point of the two-step close.
  PRESCRIPTION_COMPLETED: "PRESCRIPTION_COMPLETED",
  CANCELLED: "CANCELLED",
  RE_QUEUED: "RE_QUEUED",
};

/**
 * Statuses that occupy a place in the line and are eligible to be claimed.
 *
 * RE_QUEUED is one of them now. It used to be a transient marker that the
 * requeue write moved straight on to QUEUED; in this lifecycle it is a durable
 * waiting state a doctor is assigned from (RE_QUEUED -> ASSIGNED), so a case
 * whose call dropped waits *as* RE_QUEUED instead of being laundered back into
 * QUEUED and losing the fact that it already had a failed attempt.
 */
const WAITING_STATUSES = [STATUS.QUEUED, STATUS.ESCALATED, STATUS.RE_QUEUED];

/** Statuses where a doctor is actively occupied by the case. */
const IN_SERVICE_STATUSES = [STATUS.ASSIGNED, STATUS.CALL_CONNECTING, STATUS.CALL_CONNECTED];

const TERMINAL_STATUSES = [STATUS.PRESCRIPTION_COMPLETED, STATUS.CANCELLED];

/**
 * The call has ended but the case is still open, waiting on a prescription.
 *
 * Deliberately NOT in IN_SERVICE_STATUSES: the doctor is freed the moment the
 * call ends, so one doctor who forgets to share a prescription cannot stall
 * their whole lane. It is also not a waiting status — the patient is no longer
 * queueing for a slot, so it carries no position and no ETA.
 */
const POST_CALL_STATUSES = [STATUS.CALL_COMPLETED];

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
  POST_CALL_STATUSES,
  EMERGENCY_LEVEL,
  EMERGENCY_RANK,
  CASE_TYPE,
  SPEC_MATCH,
  DOCTOR_STATUS,
  ETA_MODEL,
  NOTIFICATION_TIER,
  GENERAL_SPECIALITIES,
};
