"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class pushnotifications extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  pushnotifications.init(
    {
      notification_object: DataTypes.JSON,
      speciality: DataTypes.STRING,
      doctor_name: DataTypes.STRING,
      date_created: DataTypes.DATE,
      user_uuid: DataTypes.STRING,
      finger_print: DataTypes.STRING,
      locale: DataTypes.STRING,
      createdAt: "date_created",
    },
    {
      sequelize,
      modelName: "pushnotifications",
    }
  );
  pushnotifications.removeAttribute("updatedAt");

  return pushnotifications;
};