"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("appointments", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      slotDay: {
        type: Sequelize.STRING,
      },
      slotDate: {
        type: Sequelize.STRING,
      },
      slotDuration: {
        type: Sequelize.INTEGER,
      },
      slotDurationUnit: {
        type: Sequelize.STRING,
      },
      slotTime: {
        type: Sequelize.STRING,
      },
      speciality: {
        type: Sequelize.STRING,
      },
      userUuid: {
        type: Sequelize.STRING,
      },
      drName: {
        type: Sequelize.STRING,
      },
      visitUuid: {
        type: Sequelize.STRING,
      },
      patientId: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.STRING,
      },
      slotJsDate: {
        type: Sequelize.DATE,
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
    await queryInterface.dropTable("appointments");
  },
};
