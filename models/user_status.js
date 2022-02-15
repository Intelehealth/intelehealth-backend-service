"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class user_status extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  user_status.init(
    {
      userUuid: DataTypes.STRING,
      lastLogin: DataTypes.DATE,
      device: DataTypes.STRING,
      version: DataTypes.STRING,
      avgTimeSpentOneDay: DataTypes.STRING,
      status: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "user_status",
    }
  );
  return user_status;
};
