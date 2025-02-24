'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class logged_in_users extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  logged_in_users.init({
    token: DataTypes.TEXT,
    userId: DataTypes.STRING,
    loggedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'logged_in_users',
  });
  return logged_in_users;
};