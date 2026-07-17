'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class turn_call_links extends Model {
    static associate(models) {
    }
  }

  turn_call_links.init({
    appointmentId: DataTypes.STRING,
    status: DataTypes.ENUM('sending', 'sent', 'failed'),
    attempts: DataTypes.INTEGER,
    sentAt: DataTypes.DATE,
    lastError: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: 'turn_call_links',
  });

  return turn_call_links;
};
