"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Messages extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Messages.init(
    {
      message: DataTypes.STRING,
      fromUser: DataTypes.STRING,
      toUser: DataTypes.STRING,
      patientId: DataTypes.STRING,
      patientName: DataTypes.STRING,
      hwName: DataTypes.STRING,
      patientPic: DataTypes.STRING,
      hwPic: DataTypes.STRING,
      visitId:DataTypes.STRING,
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "messages",
    }
  );
  return Messages;
};
