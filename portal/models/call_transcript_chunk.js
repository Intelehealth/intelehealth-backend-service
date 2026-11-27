'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class call_transcript_chunk extends Model {
    static associate(models) {
      call_transcript_chunk.belongsTo(models.call_transcript, { foreignKey: 'call_transcript_id', onDelete: 'CASCADE' });
    }
  };
  call_transcript_chunk.init({
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    call_transcript_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    chunk_number: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    bytes: DataTypes.INTEGER,
    duration_ms: DataTypes.INTEGER,
    local_rms: DataTypes.FLOAT,
    local_peak: DataTypes.FLOAT,
    remote_rms: DataTypes.FLOAT,
    remote_peak: DataTypes.FLOAT,
    local_sources: DataTypes.INTEGER,
    remote_sources: DataTypes.INTEGER,
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'queued'
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    response: DataTypes.JSON,
    error: DataTypes.TEXT,
    uploaded_at: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'call_transcript_chunk',
    tableName: 'call_transcript_chunks',
    indexes: [
      { fields: ['call_transcript_id'] },
      { unique: true, fields: ['call_transcript_id', 'chunk_number'], name: 'call_transcript_chunks_transcript_chunk_unique' }
    ]
  });
  return call_transcript_chunk;
};
