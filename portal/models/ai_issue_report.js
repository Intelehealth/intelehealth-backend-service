'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ai_issue_report extends Model {
    static associate(models) {
    }
  };
  ai_issue_report.init({
    report_uuid: {
      type: DataTypes.STRING(36),
      unique: true
    },
    visit_uuid: {
      type: DataTypes.STRING(36),
      allowNull: false
    },
    doctor_uuid: {
      type: DataTypes.STRING(36),
      allowNull: false
    },
    patient_uuid: {
      type: DataTypes.STRING(36),
      allowNull: false
    },
    ai_surface: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    suggestion_ref: DataTypes.STRING(120),
    reason: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    details: DataTypes.TEXT,
    raw_suggestion: DataTypes.JSON,
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open'
    }
  }, {
    sequelize,
    modelName: 'ai_issue_report'
  });
  return ai_issue_report;
};
