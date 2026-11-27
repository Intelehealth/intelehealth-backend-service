'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ddx_ttx_override extends Model {
    static associate(models) {
    }
  };
  ddx_ttx_override.init({
    visit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    diagnoses: DataTypes.JSON,
    treatments: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'ddx_ttx_override'
  });
  return ddx_ttx_override;
};
