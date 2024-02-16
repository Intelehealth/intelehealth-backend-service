'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class analytics extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  analytics.init({
    userUuid: DataTypes.STRING,
    openMrsId: DataTypes.STRING,
    visitId: DataTypes.STRING,
    patientUuid: DataTypes.STRING,
    action: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'analytics',
  });
  return analytics;
};