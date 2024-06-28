"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn("messages", "message", {
      type: Sequelize.TEXT,
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn("messages", "message", {
      type: Sequelize.STRING,
    });
  },
};