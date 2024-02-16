'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn("user_statuses", "village", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("user_statuses", "sanch", {
        type: Sequelize.STRING,
      }),
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn("user_statuses", "village"),
      queryInterface.removeColumn("user_statuses", "sanch"),
    ]);
  }
};
