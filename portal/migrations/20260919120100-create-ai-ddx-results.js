'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ai_ddx_results', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      visit_uuid: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      patient_uuid: {
        type: Sequelize.STRING(36),
        defaultValue: null
      },
      payload_hash: {
        type: Sequelize.STRING(64),
        defaultValue: null
      },
      request_payload: {
        type: Sequelize.TEXT('long'),
        defaultValue: null
      },
      response: {
        type: Sequelize.JSON,
        defaultValue: null
      },
      conclusion: {
        type: Sequelize.TEXT,
        defaultValue: null
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      error: {
        type: Sequelize.TEXT,
        defaultValue: null
      },
      computed_at: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('ai_ddx_results', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ai_ddx_results');
  }
};
