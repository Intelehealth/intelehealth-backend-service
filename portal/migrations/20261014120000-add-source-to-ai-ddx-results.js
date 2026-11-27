'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ai_ddx_results', 'source', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'precompute'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('ai_ddx_results', 'source');
  }
};
