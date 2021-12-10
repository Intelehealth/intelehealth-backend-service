'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class appointments extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  appointments.init({
    slotDay: DataTypes.STRING,
    slotDate: DataTypes.STRING,
    slotDuration: DataTypes.INTEGER,
    slotDurationUnit: DataTypes.STRING,
    slotTime: DataTypes.STRING,
    speciality: DataTypes.STRING,
    userUuid: DataTypes.STRING,
    drName: DataTypes.STRING,
    visitUuid: DataTypes.STRING,
    patientId: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'appointments',
  });
  return appointments;
};