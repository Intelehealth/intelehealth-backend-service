"use strict";

/**
 * location_uuid — the facility the visit was raised at, mandatory from here on.
 *
 * Done in three steps rather than one. Adding a NOT NULL column to a table that
 * already holds rows fails, or silently stamps every existing row with an empty
 * string, depending on the server's strict-mode setting. Adding it nullable
 * first means the backfill is explicit and visible in the log: any row that
 * predates the column is marked UNKNOWN rather than being given a real-looking
 * facility it was never associated with.
 *
 * SCOPE NOTE — this stores and filters by location; it does NOT split the queue
 * by it. A case still shares one line per speciality, because Intelehealth
 * doctors serve many facilities at once and partitioning the lane would leave a
 * doctor idle while another facility's patients waited. Backend LLD §13.5 raises
 * per-facility queues as an open product question; this migration deliberately
 * does not answer it. If that answer changes later, the lane scope is the one
 * place to change (queueLane.laneScope) and this column is already there to
 * carry it.
 */

const BACKFILL = "UNKNOWN";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("queue_entries", "location_uuid", {
      type: Sequelize.STRING(64),
      allowNull: true,
      after: "hw_user_uuid",
    });

    const [, meta] = await queryInterface.sequelize.query(
      "UPDATE queue_entries SET location_uuid = ? WHERE location_uuid IS NULL",
      { replacements: [BACKFILL] }
    );
    if (meta && meta.affectedRows) {
      // eslint-disable-next-line no-console
      console.log(`  backfilled ${meta.affectedRows} pre-existing row(s) as ${BACKFILL}`);
    }

    await queryInterface.changeColumn("queue_entries", "location_uuid", {
      type: Sequelize.STRING(64),
      allowNull: false,
    });

    // Backs "the queue at this facility", which is the read the HW-facing and
    // ops screens make. Paired with status because every such read is scoped to
    // the open cases rather than the whole history.
    await queryInterface.addIndex("queue_entries", ["location_uuid", "status"], {
      name: "idx_queue_entries_location_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("queue_entries", "idx_queue_entries_location_status");
    await queryInterface.removeColumn("queue_entries", "location_uuid");
  },
};
