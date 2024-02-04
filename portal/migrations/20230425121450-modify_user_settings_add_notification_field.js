'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {

  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("user_settings", "notification", {
      type: Sequelize.BOOLEAN
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("user_settings", "notification");
  }
};
