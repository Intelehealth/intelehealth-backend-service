"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class user_activity extends Model {
    static associate(models) {
      // define association here
    }
  }
  user_activity.init(
    {
      // One row per health worker per IST day: the two columns are the key, so no separate id.
      provider_uuid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        primaryKey: true,
      },
      activity_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        primaryKey: true,
      },
      active_seconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // The end of the latest period of time already counted for that day. The heartbeat adds only
      // time after it, so the same minutes reported twice (two tabs, two devices) are added once.
      covered_until: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      // CRC32 of the id of the last heartbeat request that had one, so the same request sent again adds
      // nothing. Null until a request with an id has been recorded.
      last_request_crc: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "user_activity",
      tableName: "user_activity",
      underscored: false,
      // covered_until already says when the row was last written to, so there are no
      // createdAt / updatedAt columns.
      timestamps: false,
    }
  );
  return user_activity;
};
