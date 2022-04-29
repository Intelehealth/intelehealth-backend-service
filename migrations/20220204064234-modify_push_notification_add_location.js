"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return;
    return Promise.all([
      queryInterface.addColumn("pushnotification", "location", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("pushnotification", "locale", {
        type: Sequelize.STRING,
      }),
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn("pushnotification", "location"),
      queryInterface.removeColumn("pushnotification", "locale"),
    ]);
  },
};
