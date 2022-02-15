'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_statuses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userUuid: {
        type: Sequelize.STRING
      },
      lastLogin: {
        type: Sequelize.DATE
      },
      device: {
        type: Sequelize.STRING
      },
      version: {
        type: Sequelize.STRING
      },
      avgTimeSpentOneDay: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING
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
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_statuses');
  }
};