"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class GptInputs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  GptInputs.init(
    {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true
        },
        model: DataTypes.TEXT,
        isDefault: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        }
    },
    {
      sequelize,
      modelName: "gptmodels",
    }
  );
  return GptInputs;
};
