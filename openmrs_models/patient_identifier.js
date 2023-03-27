'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class patient_identifier extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  patient_identifier.init({
    patient_identifier_id: DataTypes.INTEGER,
    patient_id: DataTypes.INTEGER,
    identifier: DataTypes.STRING,
    identifier_type: DataTypes.INTEGER,
    preferred: DataTypes.BOOLEAN,
    location_id: DataTypes.INTEGER,
    creator: DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    date_changed: DataTypes.DATE,
    changed_by: DataTypes.INTEGER,
    voided:DataTypes.BOOLEAN,
    voided_by: DataTypes.INTEGER,
    date_voided: DataTypes.DATE,
    void_reason: DataTypes.STRING,
    uuid: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'patient_identifier',
  });
  return patient_identifier;
};