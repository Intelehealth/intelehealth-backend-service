'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("links", "type", {
      type: Sequelize.STRING,
      defaultValue: "presctiption-verification",
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("links", "type");
  }
};
