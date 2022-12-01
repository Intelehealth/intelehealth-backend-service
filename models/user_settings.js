"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class user_settings extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  user_settings.init(
    {
      user_uuid: DataTypes.STRING,
      snooze_till: {
        type: DataTypes.STRING,
        defaultValue: "",
      },
      device_reg_token: DataTypes.STRING,
      locale: DataTypes.STRING,
      otp: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "user_settings",
    }
  );
  user_settings.removeAttribute("id");
  return user_settings;
};
