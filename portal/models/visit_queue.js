'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class visit_queue extends Model {
    static associate(models) {
    }
  };
  visit_queue.init({
    visit_uuid: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true
    },
    visit_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    patient_uuid: DataTypes.STRING(36),
    speciality: DataTypes.STRING(100),
    priority: {
      type: DataTypes.ENUM('high', 'normal'),
      allowNull: false,
      defaultValue: 'normal'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'waiting'
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    picked_at: DataTypes.DATE,
    visit_created_at: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'visit_queue',
    tableName: 'visit_queue'
  });
  return visit_queue;
};
