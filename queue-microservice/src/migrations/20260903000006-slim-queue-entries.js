"use strict";

/**
 * Slims queue_entries from 43 columns to 25.
 *
 * Three kinds of column came out:
 *
 *  1. NEVER READ BACK. patient_uuid, spec_match, vitals and chief_complaint
 *     were written at submit and only ever echoed to a client. The score is
 *     computed once, from the request payload — nothing re-reads them — so the
 *     priority engine is unaffected. Dropping the two clinical ones also
 *     removes the encryption-at-rest obligation LLD §13.3 attaches to holding
 *     patient data here: the doctor's own view of the complaint and vitals
 *     comes from OpenMRS, which is where that data belongs.
 *
 *  2. DERIVABLE, so storing them only created drift:
 *       escalated               → escalated_at IS NOT NULL
 *       heartbeat_flagged       → last_heartbeat_at < cutoff
 *       score_before_assignment → base_score + cumulative_aging_applied
 *     The last one is exact because the SLA job keeps base_score consistent
 *     with any forced score, so the sum always reproduces the pre-assignment
 *     value without a snapshot.
 *
 *  3. RECORD-KEEPING NOBODY QUERIED. initial_position, final_position,
 *     initial_eta_at, requeue_count, cancellation_reason, completion_source,
 *     last_ewt_pushed (superseded by last_eta_at_pushed), and
 *     requested_emergency_level. Reasons and sources are still logged and still
 *     travel in the notification; they are just no longer a column.
 *
 * location_uuid goes too, along with the QUEUE_SCOPE=SPECIALITY_LOCATION code
 * path it existed for. LLD §13.5 leaves per-facility queues an open product
 * question; carrying a column and a branch for an unchosen option is the kind
 * of weight this migration is removing. If that decision lands, it comes back
 * as its own migration.
 *
 * created_at / updated_at go as well: queued_at already records when a case
 * entered the queue, and nothing read the Sequelize pair.
 */
const DROPPED = [
  "patient_uuid",
  "location_uuid",
  "requested_emergency_level",
  "spec_match",
  "vitals",
  "chief_complaint",
  "score_before_assignment",
  "initial_position",
  "final_position",
  "initial_eta_at",
  "escalated",
  "requeue_count",
  "heartbeat_flagged",
  "last_ewt_pushed",
  "cancellation_reason",
  "completion_source",
  "created_at",
  "updated_at",
];

module.exports = {
  up: async (queryInterface) => {
    // The lane index named emergency_level and priority_score alongside
    // columns that survive, so it is rebuilt rather than dropped.
    const table = await queryInterface.describeTable("queue_entries");

    for (const column of DROPPED) {
      if (table[column]) await queryInterface.removeColumn("queue_entries", column);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("queue_entries");
    const add = async (name, spec) => {
      if (!table[name]) await queryInterface.addColumn("queue_entries", name, spec);
    };

    await add("patient_uuid", { type: Sequelize.STRING(64), allowNull: true });
    await add("location_uuid", { type: Sequelize.STRING(64), allowNull: true });
    await add("requested_emergency_level", {
      type: Sequelize.ENUM("CRITICAL", "HIGH", "MEDIUM", "LOW"),
      allowNull: true,
    });
    await add("spec_match", { type: Sequelize.TEXT, allowNull: true });
    await add("vitals", { type: Sequelize.JSON, allowNull: true });
    await add("chief_complaint", { type: Sequelize.TEXT, allowNull: true });
    await add("score_before_assignment", { type: Sequelize.DOUBLE, allowNull: true });
    await add("initial_position", { type: Sequelize.INTEGER, allowNull: true });
    await add("final_position", { type: Sequelize.INTEGER, allowNull: true });
    await add("initial_eta_at", { type: Sequelize.DATE, allowNull: true });
    await add("escalated", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await add("requeue_count", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await add("heartbeat_flagged", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await add("last_ewt_pushed", { type: Sequelize.INTEGER, allowNull: true });
    await add("cancellation_reason", { type: Sequelize.TEXT, allowNull: true });
    await add("completion_source", { type: Sequelize.STRING(32), allowNull: true });
    await add("created_at", { type: Sequelize.DATE, allowNull: true });
    await add("updated_at", { type: Sequelize.DATE, allowNull: true });
  },
};
