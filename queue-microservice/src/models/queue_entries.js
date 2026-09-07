"use strict";

const { Model } = require("sequelize");
const { STATUS, EMERGENCY_LEVEL, CASE_TYPE, ETA_MODEL } = require("../constants");

/**
 * queue_entries — backend LLD §02.1, kept deliberately lean.
 *
 * Every column here is read by code. Nothing is stored "in case someone wants
 * it later": a value that is only ever echoed back to a client, or that can be
 * derived from another column, is not a column.
 *
 * In particular this table holds NO clinical content and no patient
 * demographics. Chief complaint and vitals arrive in the submit request, are
 * scored, and are not retained — the doctor reads them from OpenMRS, which is
 * where they belong. That keeps LLD §13.3's encryption-at-rest obligation off
 * this table entirely.
 *
 * Three values are computed rather than stored, because storing them only
 * created something that could drift out of step:
 *
 *   escalated                → escalatedAt !== null
 *   heartbeatFlagged         → lastHeartbeatAt older than the stale cutoff
 *   score before assignment  → baseScore + cumulativeAgingApplied
 */
module.exports = (sequelize, DataTypes) => {
  class queue_entries extends Model {
    static associate() {}
  }

  queue_entries.init(
    {
      /* ── Identity and routing ─────────────────────────────────────────── */

      // FK → OpenMRS visit.uuid, and the natural dedupe key that makes
      // POST /submit idempotent when a flaky phone retries (LLD §09.1).
      visitUuid: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      // FK → auth-gateway user. Who to notify, and who owns the case (§13.1).
      hwUserUuid: { type: DataTypes.STRING(64), allowNull: false },
      // The lane this case waits in.
      speciality: { type: DataTypes.STRING(100), allowNull: false },
      assignedDoctorUuid: { type: DataTypes.STRING(64), allowNull: true },

      /* ── Classification: the priority engine's inputs ─────────────────── */

      emergencyLevel: {
        type: DataTypes.ENUM(...Object.values(EMERGENCY_LEVEL)),
        allowNull: false,
        defaultValue: EMERGENCY_LEVEL.LOW,
      },
      caseType: {
        type: DataTypes.ENUM(...Object.values(CASE_TYPE)),
        allowNull: false,
        defaultValue: CASE_TYPE.NEW,
      },
      // Priority Engine §00 — an existing type-15 "Flagged" encounter acts as a
      // HIGH floor. Callers pass it; QMS never queries OpenMRS itself.
      flagged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      /* ── Ordering ─────────────────────────────────────────────────────── */

      // P(case, t) — a sort key, never shown to a doctor or in a report
      // (Priority Engine §01). Always baseScore + cumulativeAgingApplied, which
      // is what makes the aging job idempotent and a release restorable
      // without a snapshot column.
      //
      // DOUBLE, not FLOAT: MySQL FLOAT is 4-byte single precision (~7 digits),
      // and §01 reasons explicitly about needing an IEEE-754 double's 15-17.
      priorityScore: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
      // Everything except the wait term: w_E·E + w_C·C + w_S·S + V.
      baseScore: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
      // w_W·W(m) already folded in. The aging job applies only the delta
      // against this, so an irregular tick cannot double- or under-apply it.
      cumulativeAgingApplied: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },

      /* ── Lifecycle ────────────────────────────────────────────────────── */

      status: {
        type: DataTypes.ENUM(...Object.values(STATUS)),
        allowNull: false,
        defaultValue: STATUS.SUBMITTED,
      },
      // queuedAt doubles as the creation time, which is why there are no
      // Sequelize timestamps on this table.
      queuedAt: { type: DataTypes.DATE, allowNull: true },
      assignedAt: { type: DataTypes.DATE, allowNull: true },
      connectedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },

      // LLD §05.3 — stamped once by the SLA force-promote job. Its presence IS
      // the escalated flag, and `WHERE escalated_at IS NULL` is the
      // escalate-once guard, so the admin notification cannot re-fire.
      escalatedAt: { type: DataTypes.DATE, allowNull: true },

      /* ── Wait estimate (LLD §07) ──────────────────────────────────────── */

      // When the consultation is expected, as an absolute instant. Anchored:
      // rewritten only when the computed wait moves, so a client can count
      // down from it locally.
      etaAt: { type: DataTypes.DATE, allowNull: true },
      // The model's last computed wait — what the anchor decision compares.
      estimatedWaitMin: { type: DataTypes.INTEGER, allowNull: true },
      // The estimate made at submit, compared against the real wait by
      // /analytics/accuracy (§09.4). Without it there is nothing to measure.
      initialEstimatedWaitMin: { type: DataTypes.INTEGER, allowNull: true },
      etaModelUsed: { type: DataTypes.ENUM(...Object.values(ETA_MODEL)), allowNull: true },

      /* ── Liveness and push bookkeeping (LLD §08, §09.1) ───────────────── */

      // A missing heartbeat flags an entry for review; it never cancels it,
      // because a patient may still be waiting even though the app died. The
      // flag is derived from this timestamp rather than written.
      lastHeartbeatAt: { type: DataTypes.DATE, allowNull: true },
      // The three push columns do distinct work: position-change detection,
      // the 5-minute ETA threshold, and the 30-second frequency cap.
      lastPositionPushed: { type: DataTypes.INTEGER, allowNull: true },
      lastEtaAtPushed: { type: DataTypes.DATE, allowNull: true },
      lastPushAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "queue_entries",
      tableName: "queue_entries",
      // queuedAt is the creation time; nothing read created_at/updated_at.
      timestamps: false,
      indexes: [
        { name: "idx_queue_entries_status_speciality", fields: ["status", "speciality"] },
        { name: "idx_queue_entries_assigned_doctor", fields: ["assigned_doctor_uuid"] },
        { name: "idx_queue_entries_queued_at", fields: ["queued_at"] },
        // Backs the ordering read — the sorted-set equivalent (LLD §03).
        {
          name: "idx_queue_entries_lane",
          fields: ["speciality", "status", "emergency_level", "priority_score"],
        },
      ],
    }
  );

  return queue_entries;
};
