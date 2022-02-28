'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class active_session extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  active_session.init({
    startTime: DataTypes.DATE,
    endTime: DataTypes.DATE,
    duration: DataTypes.STRING,
    device: DataTypes.STRING,
    userType: DataTypes.STRING,
    userUuid: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'active_session',
  });
  return active_session;
};