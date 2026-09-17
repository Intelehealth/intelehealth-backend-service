"use strict";

/**
 * patient_uuid — re-added. The slimming migration (20260903000006) dropped it
 * as "never read back", but queue data now needs to carry patient identity
 * through submit, status, and every list/panel response, the same way
 * location_uuid came back in 20260911000009.
 *
 * Nullable, unlike location_uuid: there is no safe backfill value for a
 * patient identifier, and pre-existing rows predate the field entirely.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("queue_entries", "patient_uuid", {
      type: Sequelize.STRING(64),
      allowNull: true,
      after: "visit_uuid",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("queue_entries", "patient_uuid");
  },
};
