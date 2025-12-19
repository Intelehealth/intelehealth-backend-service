'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add index to visit_id column
    await queryInterface.addIndex('call_data', ['visit_id'], {
      name: 'call_data_visit_id',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('call_data', 'call_data_visit_id');
  }
};
