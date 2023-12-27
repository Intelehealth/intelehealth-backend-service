"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class provider extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasOne(models.person, {
        as: "person",
        foreignKey: "person_id",
        sourceKey: "person_id",
      });
    }
  }
  provider.init(
    {
      provider_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      person_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      identifier: DataTypes.STRING,
      creator: DataTypes.INTEGER,
      date_created: DataTypes.DATE,
      changed_by: DataTypes.INTEGER,
      date_changed: DataTypes.DATE,
      retired: DataTypes.BOOLEAN,
      retired_by: DataTypes.INTEGER,
      date_retired: DataTypes.DATE,
      retire_reason: DataTypes.STRING,
      uuid: DataTypes.STRING,
      provider_role_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "provider",
    }
  );
  return provider;
};
