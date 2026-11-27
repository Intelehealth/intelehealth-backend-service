'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('insight_events', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      event_uuid: {
        type: Sequelize.STRING(36),
        unique: true
      },
      event_name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      source: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      actor_type: Sequelize.STRING(32),
      actor_id: Sequelize.STRING(64),
      entity_type: Sequelize.STRING(32),
      entity_id: Sequelize.STRING(64),
      properties: {
        type: Sequelize.JSON,
        defaultValue: null
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('insight_events', ['event_name', 'occurred_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('insight_events');
  }
};
