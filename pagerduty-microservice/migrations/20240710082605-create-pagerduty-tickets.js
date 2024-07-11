'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable("pagerduty_tickets", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        allowNull: false,
        type: Sequelize.STRING
      },
      incident_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      jira_ticket_id: {
        allowNull: true,
        unique: true,
        type: Sequelize.STRING
      },
      incident_key: {
        allowNull: true,
        type: Sequelize.STRING
      },
      title: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      priority: {
        allowNull: false,
        type: Sequelize.ENUM(['high','low','medium']),
        defaultValue: 'low'
      },
      urgency: {
        allowNull: false,
        type: Sequelize.ENUM(['high','low']),
        defaultValue: 'low'
      },
      status: {
        allowNull: false,
        type: Sequelize.ENUM(['triggered','acknowledged','resolved']),
        defaultValue: 'triggered'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      resolvedAt: {
        allowNull: true,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable("pagerduty_tickets");
  }
};
