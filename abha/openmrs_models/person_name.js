"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class person_name extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  person_name.init(
    {
      person_name_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      preferred: DataTypes.TINYINT,
      person_id: DataTypes.INTEGER,
      prefix: "VARCHAR",
      given_name: "VARCHAR",
      middle_name: "VARCHAR",
      family_name_prefix: "VARCHAR",
      family_name: "VARCHAR",
      family_name2: "VARCHAR",
      family_name_suffix: "VARCHAR",
      degree: "VARCHAR",
      creator: DataTypes.INTEGER,
      date_created: DataTypes.DATE,
      voided: DataTypes.TINYINT,
      voided_by: DataTypes.INTEGER,
      date_voided: DataTypes.DATE,
      void_reason: "VARCHAR",
      changed_by: DataTypes.INTEGER,
      date_changed: DataTypes.DATE,
      uuid: DataTypes.CHAR,
    },
    {
      sequelize,
      modelName: "person_name",
    }
  );
  return person_name;
};
