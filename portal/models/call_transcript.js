'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class call_transcript extends Model {
    static associate(models) {
    }
  };
  call_transcript.init({
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    visit_id: {
      type: DataTypes.STRING(36),
      allowNull: false
    },
    patient_id: DataTypes.STRING(36),
    doctor_id: DataTypes.STRING(36),
    chw_id: DataTypes.STRING(36),
    room_id: DataTypes.STRING(64),
    source: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'webapp'
    },
    call_data_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    chunk_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    recording_name: DataTypes.STRING(191),
    voicedoc_account: DataTypes.STRING(191),
    language: DataTypes.STRING(40),
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'recording'
    },
    chunks_received: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    chunks_uploaded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    chunks_failed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    transcript: DataTypes.TEXT('long'),
    summary: DataTypes.JSON,
    raw_response: DataTypes.JSON,
    combined_audio_response: DataTypes.JSON,
    visit_summary: DataTypes.TEXT('long'),
    visit_summary_response: DataTypes.JSON,
    visit_summary_at: DataTypes.DATE,
    note_obs_uuid: DataTypes.STRING(36),
    note_status: DataTypes.STRING(20),
    note_error: DataTypes.TEXT,
    error: DataTypes.TEXT,
    started_at: DataTypes.DATE,
    ended_at: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'call_transcript',
    tableName: 'call_transcripts'
  });
  return call_transcript;
};
