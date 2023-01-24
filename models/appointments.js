"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class appointments extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  appointments.init(
    {
      slotDay: DataTypes.STRING,
      slotDate: DataTypes.STRING,
      slotJsDate: DataTypes.DATE,
      slotDuration: DataTypes.INTEGER,
      slotDurationUnit: DataTypes.STRING,
      slotTime: DataTypes.STRING,
      speciality: DataTypes.STRING,
      userUuid: DataTypes.STRING,
      drName: DataTypes.STRING,
      visitUuid: DataTypes.STRING,
      patientId: DataTypes.STRING,
      locationUuid: DataTypes.STRING,
      hwUUID: DataTypes.STRING,
      patientName: DataTypes.STRING,
      openMrsId: DataTypes.STRING,
      status: DataTypes.STRING,
      createdBy: DataTypes.STRING,
      updatedBy: DataTypes.STRING,
      reason: DataTypes.STRING,
      patientAge: DataTypes.STRING,
      patientGender: DataTypes.STRING,
      patientPic: DataTypes.STRING,
      hwName: DataTypes.STRING,
      hwAge: DataTypes.STRING,
      hwGender: DataTypes.STRING,
      type: {
        type: DataTypes.ENUM,
        values: ["appointment", "followup"],
        defaultValue: "appointment",
      },
    },
    {
      sequelize,
      modelName: "appointments",
    }
  );
  return appointments;
};
