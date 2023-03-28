"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class encounter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.visit, {
        as: "visit",
        foreignKey: { allowNull: false, name: "visit_id" },
      });

      this.hasOne(models.encounter_type, {
        as: "type",
        foreignKey: "encounter_type_id",
        sourceKey: "encounter_type",
      });
    }
  }
  encounter.init(
    {
      encounter_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      encounter_type: DataTypes.INTEGER,
      patient_id: DataTypes.INTEGER,
      location_id: DataTypes.INTEGER,
      form_id: DataTypes.INTEGER,
      encounter_datetime: DataTypes.DATE,
      creator: DataTypes.INTEGER,
      date_created: DataTypes.DATE,
      voided: DataTypes.BOOLEAN,
      voided_by: DataTypes.INTEGER,
      date_voided: DataTypes.DATE,
      void_reason: DataTypes.STRING,
      changed_by: DataTypes.INTEGER,
      date_changed: DataTypes.DATE,
      visit_id: DataTypes.INTEGER,
      uuid: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "encounter",
    }
  );
  return encounter;
};
