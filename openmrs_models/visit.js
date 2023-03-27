"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class visit extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  visit.init(
    {
      visit_id: DataTypes.INTEGER,
      patient_id: DataTypes.INTEGER,
      visit_type_id: DataTypes.INTEGER,
      indication_concept_id: DataTypes.INTEGER,
      location_id: DataTypes.INTEGER,
      creator: DataTypes.INTEGER,
      date_started: DataTypes.DATE,
      date_stopped: DataTypes.DATE,
      date_created: DataTypes.DATE,
      date_changed: DataTypes.DATE,
      changed_by: DataTypes.INTEGER,
      voided: DataTypes.BOOLEAN,
      voided_by: DataTypes.INTEGER,
      date_voided: DataTypes.DATE,
      void_reason: DataTypes.STRING,
      uuid: DataTypes.STRING
      },
    {
      sequelize,
      modelName: "visit",
    }
  );
  return visit;
};