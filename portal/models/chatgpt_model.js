"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatGptInputs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatGptInputs.init(
    {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true
        },
        model: { 
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        temprature: {
            type: DataTypes.FLOAT,
            defaultValue: 1,
            allowNull: false
        },
        top_p: {
            type: DataTypes.FLOAT,
            defaultValue: 1,
            allowNull: false
        }
    },
    {
      sequelize,
      modelName: "chatgptmodels",
    }
  );
  return ChatGptInputs;
};
