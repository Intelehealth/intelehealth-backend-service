"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class pushnotification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  pushnotification.init(
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
      modelName: "pushnotification",
    }
  );
  pushnotification.removeAttribute("updatedAt");

  return pushnotification;
};