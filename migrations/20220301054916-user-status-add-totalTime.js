"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn("user_statuses", "totalTime", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("user_statuses", "androidVersion", {
        type: Sequelize.STRING,
      }),
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn("user_statuses", "totalTime"),
      queryInterface.removeColumn("user_statuses", "androidVersion"),
    ]);
  },
};
