"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class visit_attribute extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasOne(models.visit_attribute_type, {
        as: "attribute_type",
        foreignKey: "visit_attribute_type_id",
        sourceKey: "attribute_type_id",
      });
    }
  }
  visit_attribute.init(
    {
      visit_attribute_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      visit_id: DataTypes.INTEGER,
      attribute_type_id: DataTypes.INTEGER,
      value_reference: DataTypes.TEXT,
      uuid: DataTypes.STRING,
      creator: DataTypes.INTEGER,
      date_created: DataTypes.DATE,
      changed_by: DataTypes.INTEGER,
      date_changed: DataTypes.DATE,
      voided: DataTypes.BOOLEAN,
      voided_by: DataTypes.INTEGER,
      date_voided: DataTypes.DATE,
      void_reason: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "visit_attribute",
    }
  );
  return visit_attribute;
};
