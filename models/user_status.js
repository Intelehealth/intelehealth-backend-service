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
      currentTimestamp: { type: DataTypes.DATE, defaultValue: new Date() },
      lastSyncTimestamp: { type: DataTypes.DATE, defaultValue: new Date() },
      device: DataTypes.STRING,
      version: DataTypes.STRING,
      lastActivity: DataTypes.STRING,
      avgTimeSpentInADay: {
        type: DataTypes.STRING,
        defaultValue: "0h 0m",
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "active",
      },
      totalTime: {
        type: DataTypes.STRING,
        defaultValue: "0h 0m",
      },
      androidVersion: DataTypes.STRING,
      name: DataTypes.STRING,
      userType: {
        type: DataTypes.STRING,
        defaultValue: "Health Worker",
      },
    },
    {
      sequelize,
      modelName: "user_status",
    }
  );
  return user_status;
};
