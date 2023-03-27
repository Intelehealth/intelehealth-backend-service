'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class location extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  location.init({
    location_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    address1: DataTypes.STRING,
    address2: DataTypes.STRING,
    city_village: DataTypes.STRING,
    state_province: DataTypes.STRING,
    postal_code: DataTypes.STRING,
    country: DataTypes.STRING,
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    creator: DataTypes.INTEGER,
    date_created: DataTypes.DATE,
    county_district: DataTypes.STRING,
    address3: DataTypes.STRING,
    address4: DataTypes.STRING,
    address5: DataTypes.STRING,
    address6: DataTypes.STRING,
    retired: DataTypes.BOOLEAN,
    retired_by: DataTypes.INTEGER,
    date_retired: DataTypes.DATE,
    retire_reason: DataTypes.STRING,
    parent_location: DataTypes.INTEGER,
    uuid: DataTypes.STRING,
    changed_by: DataTypes.INTEGER,
    date_changed: DataTypes.DATE,
    address7: DataTypes.STRING,
    address8: DataTypes.STRING,
    address9: DataTypes.STRING,
    address10: DataTypes.STRING,
    address11: DataTypes.STRING,
    address12: DataTypes.STRING,
    address13: DataTypes.STRING,
    address14: DataTypes.STRING,
    address15: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'location',
  });
  return location;
};