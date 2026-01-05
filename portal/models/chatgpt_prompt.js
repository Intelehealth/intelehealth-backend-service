"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatGptPrompts extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatGptPrompts.init(
    {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true
        },
        key: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        value: { 
            type: DataTypes.TEXT('long'),
            allowNull: false
        }
    },
    {
      sequelize,
      modelName: "chatgptprompts",
    }
  );
  return ChatGptPrompts;
};
