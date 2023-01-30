"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn("appointments", "createdBy", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("appointments", "updatedBy", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("appointments", "reason", {
        type: Sequelize.STRING,
      }),
    ]);
  },
  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn("appointments", "createdBy"),
      queryInterface.removeColumn("appointments", "updatedBy"),
      queryInterface.removeColumn("appointments", "reason"),
    ]);
  },
};
