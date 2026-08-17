"use strict";

const { Model } = require("sequelize");

/**
 * priority_config — Priority Engine Algorithm Spec §07.
 *
 * The spec is explicit that configuration-microservice is the wrong home for
 * this: its FeaturesRoutes is getAll / getByKey / updateIsEnabled — an on/off
 * light switch with no field for a nested block of numbers. So: a small table
 * of its own, one JSON column, loaded into memory at startup and re-read when
 * an admin updates it.
 *
 * Only the newest active row is used. Updates insert a new row rather than
 * mutating the old one, so a bad tuning change can be traced and rolled back.
 */
module.exports = (sequelize, DataTypes) => {
  class priority_config extends Model {
    static associate() {}
  }

  priority_config.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      // Whole config block: weights, agingRatesPerMin, slaCapsMin, vitals, ...
      config: { type: DataTypes.JSON, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: DataTypes.STRING(64), allowNull: true },
      note: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: "priority_config",
      tableName: "priority_config",
      indexes: [{ name: "idx_priority_config_active", fields: ["is_active"] }],
    }
  );

  return priority_config;
};
