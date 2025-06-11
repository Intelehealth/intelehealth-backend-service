'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('call_data', 'call_type', {
      type: Sequelize.ENUM('video', 'audio'),
      defaultValue: 'video',
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('call_data', 'call_type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_call_data_call_type";');
  }
}; 