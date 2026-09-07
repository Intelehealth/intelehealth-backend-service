"use strict";

/**
 * Adds `eta_at` — the estimated time of consultation as an absolute instant,
 * alongside the existing `estimated_wait_min`.
 *
 * Why an anchored column rather than deriving it per request: the wait estimate
 * is a function of queue position, not of elapsed time, so recomputing
 * `now + estimated_wait_min` on every read would push the instant further into
 * the future on each call and never count down. Anchoring it means a client can
 * render a live countdown from one value and only hears from the server when
 * the estimate genuinely moves.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("queue_entries", "eta_at", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "eta_model_used",
    });
    await queryInterface.addColumn("queue_entries", "initial_eta_at", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "eta_at",
    });
    // The last anchor actually pushed to the client, so §08.2's threshold can
    // be judged on how far the promised time moved.
    await queryInterface.addColumn("queue_entries", "last_eta_at_pushed", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "last_ewt_pushed",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("queue_entries", "last_eta_at_pushed");
    await queryInterface.removeColumn("queue_entries", "initial_eta_at");
    await queryInterface.removeColumn("queue_entries", "eta_at");
  },
};
