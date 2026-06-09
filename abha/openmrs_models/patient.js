"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class patient extends Model {
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
        sourceKey: "patient_id",
      });
      this.hasMany(models.patient_identifier, {
        as: "patient_identifier",
        foreignKey: "patient_id",
        sourceKey: "patient_id",
      });
    }
  }
  patient.init(
    {
      patient_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      creator: DataTypes.INTEGER,
      date_created: DataTypes.DATE,
      changed_by: DataTypes.INTEGER,
      date_changed: DataTypes.DATE,
      voided: DataTypes.BOOLEAN,
      voided_by: DataTypes.INTEGER,
      date_voided: DataTypes.DATE,
      void_reason: DataTypes.STRING,
      allergy_status: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "patient",
    }
  );
  return patient;
};
