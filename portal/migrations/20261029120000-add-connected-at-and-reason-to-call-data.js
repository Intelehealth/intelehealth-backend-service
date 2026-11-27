'use strict';

/**
 * connected_at: when the participants actually connected, so call_duration is connected time
 * and start_time can stay the attempt start.
 * reason: added to the original create-call-data migration after it had already run on some
 * databases, so add it here only where it is missing.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('call_data');
    if (!table.reason) {
      await queryInterface.addColumn('call_data', 'reason', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      });
    }
    if (!table.connected_at) {
      await queryInterface.addColumn('call_data', 'connected_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // reason predates this migration on most databases, so only connected_at is removed.
    await queryInterface.removeColumn('call_data', 'connected_at');
  }
};
