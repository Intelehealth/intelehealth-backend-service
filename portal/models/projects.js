"use strict";
const { Model } = require("sequelize");
const videos = require("./videos");
module.exports = (sequelize, DataTypes) => {
  class projects extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.videos, {
        as: "videos",
        foreignKey: "projectId",
        sourceKey: "id",
        onDelete: "cascade",
      });
    }
  }
  projects.init(
    {
      name: DataTypes.STRING,
      packageId: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "projects",
      timestamps: true,
    }
  );

  return projects;
};
