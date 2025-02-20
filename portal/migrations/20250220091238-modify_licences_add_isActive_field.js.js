'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.addColumn("licences", "isActive", {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.removeColumn("licences", "isActive");
  },
};
