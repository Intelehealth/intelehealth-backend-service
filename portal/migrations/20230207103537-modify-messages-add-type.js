"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("messages", "type", {
      type: Sequelize.STRING,
    });
  },
  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("messages", "type");
  },
};
