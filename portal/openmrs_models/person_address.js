"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class person_address extends Model {
    static associate(models) {
      // define association here
    }
  }
  person_address.init(
    {
      person_address_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      person_id: DataTypes.INTEGER,
      preferred: DataTypes.BOOLEAN,
      address1: DataTypes.STRING,
      address2: DataTypes.STRING,
      city_village: DataTypes.STRING,
      state_province: DataTypes.STRING,
      country: DataTypes.STRING,
      county_district: DataTypes.STRING,
      address3: DataTypes.STRING,
      postal_code: DataTypes.STRING,
      voided: DataTypes.BOOLEAN,
      uuid: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "person_address",
    }
  );
  return person_address;
};
