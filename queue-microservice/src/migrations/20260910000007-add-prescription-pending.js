"use strict";

/**
 * Adds the PRESCRIPTION_PENDING status, and the one timestamp it needs.
 *
 * A finished call is not a finished visit. The doctor still owes a
 * prescription, and until that is shared the case is not done — so the
 * lifecycle gains a step between CONNECTED and COMPLETED:
 *
 *     CONNECTED -> PRESCRIPTION_PENDING -> COMPLETED
 *
 * `call_ended_at` is the moment the call itself finished, which COMPLETED can
 * no longer stand in for. It earns its column twice over:
 *
 *   1. The consult duration that feeds doctor_service_stats.avg_consult_min —
 *      μ in the §07 wait estimate — must be measured connected -> call ended.
 *      Measuring it to completed_at would fold however long the prescription
 *      took into μ and inflate every ETA in the speciality.
 *   2. It is the only way to tell a prescription two minutes outstanding from
 *      one outstanding since yesterday, which is what the ops view reports on.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("queue_entries");

    // MySQL ENUMs are altered by restating the full member list.
    await queryInterface.changeColumn("queue_entries", "status", {
      type: Sequelize.ENUM(
        "SUBMITTED",
        "QUEUED",
        "ESCALATED",
        "ASSIGNED",
        "CONNECTING",
        "CONNECTED",
        "PRESCRIPTION_PENDING",
        "COMPLETED",
        "CANCELLED",
        "RE_QUEUED"
      ),
      allowNull: false,
      defaultValue: "SUBMITTED",
    });

    if (!table.call_ended_at) {
      await queryInterface.addColumn("queue_entries", "call_ended_at", {
        type: Sequelize.DATE,
        allowNull: true,
        after: "connected_at",
      });
    }

    // Cases already open when this ships have no prescription step to wait on.
    await queryInterface.addIndex("queue_entries", ["status", "call_ended_at"], {
      name: "idx_queue_entries_prescription_pending",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "queue_entries",
      "idx_queue_entries_prescription_pending"
    );

    // Nothing may be left sitting in a status the enum will no longer hold.
    await queryInterface.sequelize.query(
      "UPDATE queue_entries SET status = 'COMPLETED' WHERE status = 'PRESCRIPTION_PENDING'"
    );

    await queryInterface.changeColumn("queue_entries", "status", {
      type: Sequelize.ENUM(
        "SUBMITTED",
        "QUEUED",
        "ESCALATED",
        "ASSIGNED",
        "CONNECTING",
        "CONNECTED",
        "COMPLETED",
        "CANCELLED",
        "RE_QUEUED"
      ),
      allowNull: false,
      defaultValue: "SUBMITTED",
    });

    const table = await queryInterface.describeTable("queue_entries");
    if (table.call_ended_at) {
      await queryInterface.removeColumn("queue_entries", "call_ended_at");
    }
  },
};
