"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class SupportMessages extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  SupportMessages.init(
    {
      message: DataTypes.STRING,
      from: DataTypes.STRING,
      to: DataTypes.STRING,
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      /** possible values - text/attachment */
      type: {
        type: DataTypes.STRING,
        defaultValue: "text",
      },
    },
    {
      sequelize,
      modelName: "supportmessages",
    }
  );
  return SupportMessages;
};
