"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("abdm_visit_status", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      requestData: {
        type: Sequelize.JSON,
      },
      error: {
        type: Sequelize.JSON,
      },
      response: {
        type: Sequelize.JSON,
      },
      link_status_error: {
        type: Sequelize.JSON,
      },
      link_status_response: {
        type: Sequelize.JSON,
      },
      requestId: {
        type: Sequelize.STRING,
      },
      visitUuid: {
        type: Sequelize.STRING,
      },
      isLinked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isInvalid: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      inProcessInCron: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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
    await queryInterface.dropTable("abdm_visit_status");
  },
};
