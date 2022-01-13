'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class appointment_settings extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  appointment_settings.init({
    slotDuration: DataTypes.INTEGER,
    slotDurationUnit: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'appointment_settings',
  });
  return appointment_settings;
};