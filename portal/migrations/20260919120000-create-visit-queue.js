'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('visit_queue', {
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
      visit_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      patient_uuid: {
        type: Sequelize.STRING(36),
        defaultValue: null
      },
      speciality: {
        type: Sequelize.STRING(100),
        defaultValue: null
      },
      priority: {
        type: Sequelize.ENUM('high', 'normal'),
        allowNull: false,
        defaultValue: 'normal'
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'waiting'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      picked_at: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      visit_created_at: {
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

    await queryInterface.addIndex('visit_queue', ['status', 'priority', 'visit_created_at'], {
      name: 'visit_queue_pick_idx'
    });
    await queryInterface.addIndex('visit_queue', ['speciality']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('visit_queue');
  }
};
