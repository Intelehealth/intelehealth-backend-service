"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.addColumn("user_statuses", "secondaryVillage", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.removeColumn("user_statuses", "secondaryVillage");
  },
};
