"use strict";

const { Model } = require("sequelize");
const {
  STATUS,
  EMERGENCY_LEVEL,
  CASE_TYPE,
  SPEC_MATCH,
  ETA_MODEL,
} = require("../constants");

/**
 * queue_entries — backend LLD §02.1.
 *
 * References OpenMRS / auth-gateway UUIDs as foreign keys; it deliberately does
 * NOT re-store patient or doctor name/email/phone (LLD §02, "correction from
 * the architecture ERD" — those identities already exist elsewhere).
 */
module.exports = (sequelize, DataTypes) => {
  class queue_entries extends Model {
    static associate() {}
  }

  queue_entries.init(
    {
      // FK → OpenMRS visit.uuid. UNIQUE: this is the natural dedupe key that
      // makes POST /submit idempotent when a flaky mobile connection retries
      // a call that actually succeeded (LLD §09.1).
      visitUuid: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      // FK → OpenMRS person.uuid. Reference only, no demographics stored here.
      patientUuid: { type: DataTypes.STRING(64), allowNull: true },
      // FK → auth-gateway user.
      hwUserUuid: { type: DataTypes.STRING(64), allowNull: false },
      speciality: { type: DataTypes.STRING(100), allowNull: false },
      // LLD §13.5 — populated so the queue can be split per facility later
      // without a migration. See config.queue.scope.
      locationUuid: { type: DataTypes.STRING(64), allowNull: true },

      emergencyLevel: {
        type: DataTypes.ENUM(...Object.values(EMERGENCY_LEVEL)),
        allowNull: false,
        defaultValue: EMERGENCY_LEVEL.LOW,
      },
      // The level the caller asked for, before the flagged/vitals floors were
      // applied (Priority Engine §00, §02.1). Kept for auditability.
      requestedEmergencyLevel: {
        type: DataTypes.ENUM(...Object.values(EMERGENCY_LEVEL)),
        allowNull: true,
      },
      caseType: {
        type: DataTypes.ENUM(...Object.values(CASE_TYPE)),
        allowNull: false,
        defaultValue: CASE_TYPE.NEW,
      },
      specMatch: {
        type: DataTypes.ENUM(...Object.values(SPEC_MATCH)),
        allowNull: false,
        defaultValue: SPEC_MATCH.EXACT,
      },
      // Priority Engine §00 — an existing type-15 "Flagged" encounter acts as a
      // HIGH floor. Callers pass the flag; QMS never queries OpenMRS itself.
      flagged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // Patient clinical payload used by V(vitals) and shown on the doctor
      // panel. This is real patient data — see LLD §13.3 on encryption at rest.
      vitals: { type: DataTypes.JSON, allowNull: true },
      chiefComplaint: { type: DataTypes.TEXT, allowNull: true },

      // P(case, t) — a sort key, never displayed to a doctor or in a report
      // (Priority Engine §01). Composed of baseScore + agingApplied so the
      // aging job can be fully idempotent (§03).
      //
      // DOUBLE, not FLOAT. LLD §02.1's column table says FLOAT, but MySQL FLOAT
      // is 4-byte single precision — roughly 7 significant decimal digits,
      // whereas Priority Engine §01 reasons explicitly about needing the
      // 15-17 digits an IEEE-754 double carries. Under FLOAT, base + aging does
      // not round-trip exactly and near-equal scores collapse into false ties.
      priorityScore: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
      // Everything except the wait term: w_E·E + w_C·C + w_S·S + V.
      baseScore: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
      // w_W·W(m) already folded into priorityScore. The aging job applies only
      // the delta against this, so an irregular tick schedule cannot double- or
      // under-apply the bonus (Priority Engine §03).
      cumulativeAgingApplied: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
      // Score restored on release, so a doctor handing a case back doesn't
      // penalise it (LLD §09.2).
      scoreBeforeAssignment: { type: DataTypes.DOUBLE, allowNull: true },

      status: {
        type: DataTypes.ENUM(...Object.values(STATUS)),
        allowNull: false,
        defaultValue: STATUS.SUBMITTED,
      },
      assignedDoctorUuid: { type: DataTypes.STRING(64), allowNull: true },

      queuedAt: { type: DataTypes.DATE, allowNull: true },
      assignedAt: { type: DataTypes.DATE, allowNull: true },
      connectedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },

      // For post-hoc accuracy analysis (LLD §02.1).
      initialPosition: { type: DataTypes.INTEGER, allowNull: true },
      finalPosition: { type: DataTypes.INTEGER, allowNull: true },
      // Last EWT pushed to the HW, and the estimate made at submit time —
      // /analytics/accuracy compares the latter against the real wait (§09.4).
      estimatedWaitMin: { type: DataTypes.INTEGER, allowNull: true },
      initialEstimatedWaitMin: { type: DataTypes.INTEGER, allowNull: true },
      etaModelUsed: { type: DataTypes.ENUM(...Object.values(ETA_MODEL)), allowNull: true },

      // LLD §05.3 — set once by the SLA force-promote job. Checked before
      // promoting so the admin notification cannot re-fire every minute.
      escalated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      escalatedAt: { type: DataTypes.DATE, allowNull: true },

      // LLD §04 — RE_QUEUED bump count, for cases whose call kept failing.
      requeueCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      // LLD §09.1 — keep-alive. A missing heartbeat FLAGS the entry for review;
      // it never auto-cancels it, because a patient may still be waiting even
      // if the app died.
      lastHeartbeatAt: { type: DataTypes.DATE, allowNull: true },
      heartbeatFlagged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // LLD §08 — push bookkeeping. The MySQL equivalent of the design's
      // hw:{id}:last_ewt key: what was last pushed, and when.
      lastPositionPushed: { type: DataTypes.INTEGER, allowNull: true },
      lastEwtPushed: { type: DataTypes.INTEGER, allowNull: true },
      lastPushAt: { type: DataTypes.DATE, allowNull: true },

      cancellationReason: { type: DataTypes.TEXT, allowNull: true },
      // How the case reached a terminal state: DOCTOR, HW, STALE_SWEEP, ADMIN.
      completionSource: { type: DataTypes.STRING(32), allowNull: true },
    },
    {
      sequelize,
      modelName: "queue_entries",
      tableName: "queue_entries",
      indexes: [
        { name: "idx_queue_entries_status_speciality", fields: ["status", "speciality"] },
        { name: "idx_queue_entries_assigned_doctor", fields: ["assigned_doctor_uuid"] },
        { name: "idx_queue_entries_queued_at", fields: ["queued_at"] },
        // Backs the ordering query — the sorted-set equivalent (LLD §03).
        {
          name: "idx_queue_entries_lane",
          fields: ["speciality", "status", "emergency_level", "priority_score"],
        },
      ],
    }
  );

  return queue_entries;
};
