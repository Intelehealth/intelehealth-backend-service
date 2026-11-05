'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('call_transcripts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      visit_id: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      patient_id: {
        type: Sequelize.STRING(36),
        defaultValue: null
      },
      doctor_id: {
        type: Sequelize.STRING(36),
        defaultValue: null
      },
      chw_id: {
        type: Sequelize.STRING(36),
        defaultValue: null
      },
      room_id: {
        type: Sequelize.STRING(64),
        defaultValue: null
      },
      source: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'webapp'
      },
      call_data_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      chunk_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true
      },
      recording_name: {
        type: Sequelize.STRING(191),
        defaultValue: null
      },
      language: {
        type: Sequelize.STRING(40),
        defaultValue: null
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'recording'
      },
      chunks_received: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      chunks_uploaded: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      chunks_failed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      transcript: {
        type: Sequelize.TEXT('long'),
        defaultValue: null
      },
      summary: {
        type: Sequelize.JSON,
        defaultValue: null
      },
      raw_response: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null
      },
      combined_audio_response: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null
      },
      error: {
        type: Sequelize.TEXT,
        defaultValue: null
      },
      started_at: {
        type: Sequelize.DATE,
        defaultValue: null
      },
      ended_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('call_transcripts', ['visit_id']);
    await queryInterface.addIndex('call_transcripts', ['status']);
    await queryInterface.addIndex('call_transcripts', ['source']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('call_transcripts');
  }
};
