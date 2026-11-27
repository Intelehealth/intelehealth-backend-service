'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('call_recordings', ['room_id', 'end_time'], {
      name: 'call_recordings_room_id_end_time'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('call_recordings', 'call_recordings_room_id_end_time');
  }
};
