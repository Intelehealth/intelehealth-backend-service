'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ddx_ttx_overrides', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      visit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      doctor_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      patient_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      diagnoses: {
        type: Sequelize.JSON,
        defaultValue: null
      },
      treatments: {
        type: Sequelize.JSON,
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

    await queryInterface.addIndex('ddx_ttx_overrides', ['doctor_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ddx_ttx_overrides');
  }
};
