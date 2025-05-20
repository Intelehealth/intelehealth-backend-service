"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("messages", "isDelivered", {
      type: Sequelize.STRING,
    });
  },
  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("messages", "isDelivered");
  },
};