"use strict";
const { Model } = require("sequelize");
const videos = require("./videos");
module.exports = (sequelize, DataTypes) => {
  class video_categories extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.videos, {
        as: "videos",
        foreignKey: "categoryId",
        sourceKey: "id",
        onDelete: "cascade",
      });
    }
  }
  video_categories.init(
    {
      name: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "video_categories",
      timestamps: true,
    }
  );

  return video_categories;
};