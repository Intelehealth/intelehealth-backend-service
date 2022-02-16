"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn("user_statuses", "userType", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("user_statuses", "name", {
        type: Sequelize.STRING,
      }),
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn("user_statuses", "userType"),
      queryInterface.removeColumn("user_statuses", "name"),
    ]);
  },
};
