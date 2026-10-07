'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ai_ddx_result extends Model {
    static associate(models) {
    }
  };
  ai_ddx_result.init({
    visit_uuid: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true
    },
    patient_uuid: DataTypes.STRING(36),
    payload_hash: DataTypes.STRING(64),
    request_payload: DataTypes.TEXT('long'),
    response: DataTypes.JSON,
    conclusion: DataTypes.TEXT,
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending'
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    error: DataTypes.TEXT,
    computed_at: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'ai_ddx_result',
    tableName: 'ai_ddx_results'
  });
  return ai_ddx_result;
};
