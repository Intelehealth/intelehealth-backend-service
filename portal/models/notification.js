'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Notification.init({
    title: {
      type: DataTypes.STRING
    },
    description: {
      type: DataTypes.STRING
    },
    user_uuid: DataTypes.STRING,
    payload: {
      type: DataTypes.JSON,
      default: null
    },
    type: {
      type: DataTypes.ENUM,
      values: ["prescription"],
      defaultValue: "prescription",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      default: false
    }
  }, {
    sequelize,
    modelName: 'notifications',
  });
  return Notification;
};