"use strict";

const { Model } = require("sequelize");

/**
 * doctor_service_stats — backend LLD §02.3.
 *
 * avg_consult_min is an exponential moving average updated on every completion.
 * It is μ in the wait-time formula (§07); nothing else feeds that term.
 */
module.exports = (sequelize, DataTypes) => {
  class doctor_service_stats extends Model {
    static associate() {}
  }

  doctor_service_stats.init(
    {
      doctorUuid: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
      speciality: { type: DataTypes.STRING(100), allowNull: true },
      avgConsultMin: { type: DataTypes.DOUBLE, allowNull: true },
      // Number of completed consultations folded into the EMA so far.
      consultCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      // 0-5. Feeds the 10% rating term of doctor assignment (LLD §06). No
      // rating source exists in the repo yet, so this is nullable and falls
      // back to config.queue.defaultDoctorRating.
      rating: { type: DataTypes.DOUBLE, allowNull: true },
    },
    {
      sequelize,
      modelName: "doctor_service_stats",
      tableName: "doctor_service_stats",
      indexes: [{ name: "idx_doctor_stats_speciality", fields: ["speciality"] }],
    }
  );

  return doctor_service_stats;
};
