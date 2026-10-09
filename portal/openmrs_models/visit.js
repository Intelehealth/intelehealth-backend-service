"use strict";
const { Model } = require("sequelize");
const { OPENMRS_ID_IDENTIFIER_TYPE } = require("../constants/constant");
module.exports = (sequelize, DataTypes) => {
  class visit extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.encounter, {
        as: "encounters",
        foreignKey: "visit_id",
        sourceKey: "visit_id",
      });
      this.hasMany(models.visit_attribute, {
        as: "attributes",
        foreignKey: "visit_id",
        sourceKey: "visit_id",
      });
      this.hasOne(models.patient_identifier, {
        as: "patient",
        foreignKey: "patient_id",
        sourceKey: "patient_id",
        // Without this scope, a patient with ABHA-linked identifiers (identifier_type 6/7)
        // can resolve to their ABHA Number/Address instead of their OpenMRS ID (type 3).
        scope: {
          identifier_type: OPENMRS_ID_IDENTIFIER_TYPE,
          voided: 0,
        },
      });
      this.hasOne(models.person, {
        as: "person",
        foreignKey: "person_id",
        sourceKey: "patient_id",
      });
      this.hasOne(models.person_name, {
        as: "patient_name",
        foreignKey: "person_id",
        sourceKey: "patient_id",
      });
      this.hasMany(models.person_attribute, {
        as: "person_attribute",
        foreignKey: "person_id",
        sourceKey: "patient_id",
      });
      this.hasOne(models.location, {
        as: "location",
        foreignKey: "location_id",
        sourceKey: "location_id",
      });
    }
  }
  visit.init(
    {
      visit_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
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
      uuid: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "visit",
    }
  );
  return visit;
};
