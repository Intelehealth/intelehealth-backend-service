'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('call_transcripts', 'voicedoc_account', { type: Sequelize.STRING(191), allowNull: true });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('call_transcripts', 'voicedoc_account');
  }
};
