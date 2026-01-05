'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable("links");

    if (!tableDescription.type) {
      return queryInterface.addColumn("links", "type", {
        type: Sequelize.STRING,
        defaultValue: "presctiption-verification",
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable("links");

    if (tableDescription.type) {
      return queryInterface.removeColumn("links", "type");
    }
  }
};
