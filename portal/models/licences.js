'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class licences extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  licences.init({
    keyName: DataTypes.STRING,
    expiry: DataTypes.DATE,
    imageValue: DataTypes.TEXT,
    imageName: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'licences',
  });
  return licences;
};