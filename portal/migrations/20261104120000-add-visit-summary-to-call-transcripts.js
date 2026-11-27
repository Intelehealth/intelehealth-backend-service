'use strict';

const COLUMNS = (Sequelize) => ({
  visit_summary: { type: Sequelize.TEXT('long'), allowNull: true },
  visit_summary_response: { type: Sequelize.JSON, allowNull: true },
  visit_summary_at: { type: Sequelize.DATE, allowNull: true },
  note_obs_uuid: { type: Sequelize.STRING(36), allowNull: true },
  note_status: { type: Sequelize.STRING(20), allowNull: true },
  note_error: { type: Sequelize.TEXT, allowNull: true },
});

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const [name, spec] of Object.entries(COLUMNS(Sequelize))) {
      await queryInterface.addColumn('call_transcripts', name, spec);
    }
  },

  down: async (queryInterface, Sequelize) => {
    for (const name of Object.keys(COLUMNS(Sequelize))) {
      await queryInterface.removeColumn('call_transcripts', name);
    }
  }
};
