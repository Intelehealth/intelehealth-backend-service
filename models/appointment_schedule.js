"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class appointment_schedule extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  appointment_schedule.init(
    {
      userUuid: DataTypes.STRING,
      slotDays: DataTypes.STRING,
      slotSchedule: DataTypes.JSON,
      speciality: DataTypes.STRING,
      drName: DataTypes.STRING,
      type: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "appointment_schedule",
    }
  );
  return appointment_schedule;
};
