"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn("appointment_schedules", "startDate", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("appointment_schedules", "endDate", {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn("appointment_schedules", "daysOff", {
        type: Sequelize.JSON,
      }),
    ]);
  },
  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn("appointment_schedules", "startDate"),
      queryInterface.removeColumn("appointment_schedules", "endDate"),
      queryInterface.removeColumn("appointment_schedules", "daysOff"),
    ]);
  },
};