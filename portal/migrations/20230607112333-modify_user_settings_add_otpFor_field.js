'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {

  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("user_settings", "otpFor", {
      type: Sequelize.ENUM,
      values: ['U','P','A']
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("user_settings", "otpFor");
  }
};