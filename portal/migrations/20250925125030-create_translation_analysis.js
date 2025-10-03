'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
  await queryInterface.createTable('translation_analysis', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      visitId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      conceptId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      is_rejected: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_datetime: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      rejected_en_text: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      rejected_regional_text: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      api_failure_retry_counts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      updated_datetime: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('translation_analysis', ['visitId']);
    await queryInterface.addIndex('translation_analysis', ['conceptId']);
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('translation_analysis');
  }
};
