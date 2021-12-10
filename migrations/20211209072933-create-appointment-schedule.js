"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("appointment_schedules", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userUuid: {
        type: Sequelize.STRING,
      },
      slotDays: {
        type: Sequelize.STRING,
      },
      slotSchedule: {
        type: Sequelize.JSON,
      },
      speciality: {
        type: Sequelize.STRING,
      },
      drName: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("appointment_schedules");
  },
};
