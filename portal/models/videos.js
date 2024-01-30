"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class videos extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  videos.init(
    {
      title: DataTypes.STRING,
      projectId: DataTypes.INTEGER,
      createdBy: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "videos",
      timestamps: true,
    }
  );
  return videos;
};
