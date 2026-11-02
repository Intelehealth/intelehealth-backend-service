'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('call_transcript_chunks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      call_transcript_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'call_transcripts',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      chunk_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      bytes: {
        type: Sequelize.INTEGER,
        defaultValue: null
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        defaultValue: null
      },
      local_rms: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null
      },
      local_peak: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null
      },
      remote_rms: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null
      },
      remote_peak: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null
      },
      local_sources: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      remote_sources: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'queued'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      response: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null
      },
      uploaded_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('call_transcript_chunks', ['call_transcript_id']);
    await queryInterface.addIndex('call_transcript_chunks', ['call_transcript_id', 'chunk_number'], {
      unique: true,
      name: 'call_transcript_chunks_transcript_chunk_unique'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('call_transcript_chunks');
  }
};
