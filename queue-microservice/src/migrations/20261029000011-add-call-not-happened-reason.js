"use strict";

/**
 * call_not_happened_reason — why a doctor's call with the patient never
 * happened (network issue, patient unavailable, async consultation, …), as
 * picked in the doctor webapp. Set by
 * POST /api/queue/visit/:visitUuid/call-not-happened.
 *
 * Nullable: almost every case has a call, and pre-existing rows predate it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("queue_entries", "call_not_happened_reason", {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: "call_ended_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("queue_entries", "call_not_happened_reason");
  },
};
