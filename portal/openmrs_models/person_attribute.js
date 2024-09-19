"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class person_attribute extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  person_attribute.init(
    {
      person_attribute_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      person_id: DataTypes.INTEGER,
      person_attribute_type_id: DataTypes.INTEGER,
      value: DataTypes.TEXT,
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
      modelName: "person_attribute",
    }
  );
  return person_attribute;
};
