'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ai_issue_reports', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      report_uuid: {
        type: Sequelize.STRING(36),
        unique: true
      },
      visit_uuid: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      doctor_uuid: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      patient_uuid: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      ai_surface: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      suggestion_ref: {
        type: Sequelize.STRING(120),
        defaultValue: null
      },
      reason: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      details: {
        type: Sequelize.TEXT,
        defaultValue: null
      },
      raw_suggestion: {
        type: Sequelize.JSON,
        defaultValue: null
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'open'
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

    await queryInterface.addIndex('ai_issue_reports', ['visit_uuid']);
    await queryInterface.addIndex('ai_issue_reports', ['doctor_uuid']);
    await queryInterface.addIndex('ai_issue_reports', ['status', 'ai_surface']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ai_issue_reports');
  }
};
