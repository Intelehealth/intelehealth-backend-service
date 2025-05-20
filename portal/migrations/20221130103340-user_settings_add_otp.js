"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("user_settings", "otp", {
      type: Sequelize.STRING(10),
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("user_settings", "otp");
  },
};
