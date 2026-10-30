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
      // The time already counted for that day, as sorted intervals of seconds since IST midnight:
      // "32400-43200,43500-43800" (see services/activity-intervals.js). Overlapping or touching time is
      // one interval, so the same minutes reported twice (two tabs, two devices), or in any order,
      // are counted once. active_seconds is the total length of these intervals.
      covered_intervals: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      // CRC32 of the ids of the last 20 heartbeat requests that had one, comma separated, oldest first, so
      // the same request sent again adds nothing even when another device sent a request in between.
      // Empty until a request with an id has been recorded.
      recent_request_crcs: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "user_activity",
      tableName: "user_activity",
      underscored: false,
      // The row holds only the day's numbers, so there are no createdAt / updatedAt columns.
      timestamps: false,
    }
  );
  return user_activity;
};
