"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class encounter_provider extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasOne(models.provider, {
        as: "provider",
        foreignKey: "provider_id",
        sourceKey: "provider_id",
      });
    }
  }
  encounter_provider.init(
    {
      encounter_provider_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      encounter_id: DataTypes.INTEGER,
      provider_id: DataTypes.INTEGER,
      encounter_role_id: DataTypes.INTEGER,
      creator: DataTypes.INTEGER,
      date_created: DataTypes.DATE,
      changed_by: DataTypes.INTEGER,
      date_changed: DataTypes.DATE,
      voided: DataTypes.BOOLEAN,
      voided_by: DataTypes.INTEGER,
      date_voided: DataTypes.DATE,
      void_reason: DataTypes.STRING,
      uuid: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "encounter_provider",
    }
  );
  return encounter_provider;
};
