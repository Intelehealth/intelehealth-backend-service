"use strict";

const defaults = require("../config/priority.default");

/** priority_config — Priority Engine Algorithm Spec §07 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("priority_config", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      config: { type: Sequelize.JSON, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updated_by: { type: Sequelize.STRING(64), allowNull: true },
      note: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex("priority_config", ["is_active"], {
      name: "idx_priority_config_active",
    });

    // Seed the documented defaults so the service has a valid config on first
    // boot. Σweights = 1.0 is re-checked at load time regardless (§07).
    await queryInterface.bulkInsert("priority_config", [
      {
        config: JSON.stringify(defaults),
        is_active: true,
        updated_by: null,
        note: "Seeded defaults — Priority Engine spec §02/§07. Pending clinical sign-off (§00).",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("priority_config");
  },
};
