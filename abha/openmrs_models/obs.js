"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class obs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasOne(models.concept, {
        as: "concept",
        foreignKey: "concept_id",
        sourceKey: "concept_id",
      });
    }
  }
  obs.init(
    {
      obs_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      person_id: DataTypes.INTEGER,
      concept_id: DataTypes.INTEGER,
      encounter_id: DataTypes.INTEGER,
      order_id: DataTypes.INTEGER,
      obs_datetime: DataTypes.DATE,
      location_id: DataTypes.INTEGER,
      obs_group_id: DataTypes.INTEGER,
      accession_number: DataTypes.STRING,
      value_group_id: DataTypes.INTEGER,
      value_coded: DataTypes.INTEGER,
      value_coded_name_id: DataTypes.INTEGER,
      value_drug: DataTypes.INTEGER,
      value_datetime: DataTypes.DATE,
      value_numeric: DataTypes.DOUBLE,
      value_modifier: DataTypes.STRING,
      value_text: DataTypes.TEXT,
      value_complex: DataTypes.STRING,
      comments: DataTypes.STRING,
      creator: DataTypes.INTEGER,
      date_created: DataTypes.DATE,
      voided: DataTypes.BOOLEAN,
      voided_by: DataTypes.INTEGER,
      date_voided: DataTypes.DATE,
      void_reason: DataTypes.STRING,
      uuid: DataTypes.STRING,
      previous_version: DataTypes.INTEGER,
      form_namespace_and_path: DataTypes.STRING,
      status: DataTypes.STRING,
      interpretation: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "obs",
    }
  );
  return obs;
};
