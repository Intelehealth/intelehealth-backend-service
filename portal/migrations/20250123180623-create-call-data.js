'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('call_data', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      doctor_id: {
        type: Sequelize.STRING
      },
      visit_id: {
        type: Sequelize.STRING
      },
      chw_id: {
        type: Sequelize.STRING
      },
      room_id: {
        type: Sequelize.STRING
      },
      call_status: {
        type: Sequelize.STRING
      },
      reason: {
        type: Sequelize.STRING
      },
      call_duration: {
        type: Sequelize.INTEGER
      },
      start_time: {
        type: Sequelize.DATE
      },
      end_time: {
        type: Sequelize.DATE
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
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('call_data');
  }
};