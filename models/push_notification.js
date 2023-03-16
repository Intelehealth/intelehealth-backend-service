"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class push_notification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  push_notification.init(
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      notification_object: DataTypes.JSON,
      speciality: DataTypes.STRING,
      doctor_name: DataTypes.STRING,
      date_created: DataTypes.DATE,
      user_uuid: DataTypes.STRING,
      fingerprint: DataTypes.STRING,
      locale: DataTypes.STRING,
      location: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "push_notification",
    }
  );
  return push_notification;
};
