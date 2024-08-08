"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class facility_contacts extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  facility_contacts.init(
    {
      facility_name: DataTypes.STRING,
      incharge_name: DataTypes.STRING,
      contact_no: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "facility_contacts",
    }
  );
  return facility_contacts;
};
