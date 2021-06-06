"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("user_settings", "type", Sequelize.STRING);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("user_settings", "type");
  },
};
