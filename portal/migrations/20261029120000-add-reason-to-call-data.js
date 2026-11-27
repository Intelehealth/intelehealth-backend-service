'use strict';

/**
 * reason was added to the original create-call-data migration after it had already run on some
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
  },

  // reason predates this migration on most databases, so it is not removed here.
  down: async () => {}
};
