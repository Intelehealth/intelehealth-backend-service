"use strict";

const { Model } = require("sequelize");
const { DOCTOR_STATUS } = require("../constants");

/**
 * doctor_queue_status — backend LLD §02.2.
 *
 * "The single most important new table." The Little's Law production report
 * named live doctor status as the #1 fix needed: naive wait estimates were off
 * by 168 minutes MAE without it, dropping to ~52 once in-service state was
 * accounted for.
 *
 * The design has Redis holding the live copy and this table the durable one.
 * On MySQL-only storage this table IS the live copy — there is one row per
 * doctor and every read goes through it.
 */
module.exports = (sequelize, DataTypes) => {
  class doctor_queue_status extends Model {
    static associate() {}
  }

  doctor_queue_status.init(
    {
      doctorUuid: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
      speciality: { type: DataTypes.STRING(100), allowNull: true },
      status: {
        type: DataTypes.ENUM(...Object.values(DOCTOR_STATUS)),
        allowNull: false,
        defaultValue: DOCTOR_STATUS.OFFLINE,
      },
      currentQueueEntryId: { type: DataTypes.INTEGER, allowNull: true },
      lastChangedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "doctor_queue_status",
      tableName: "doctor_queue_status",
      indexes: [
        // Backs the "which doctors are free for this speciality" read — the
        // doctors:active:{speciality} set in the design (LLD §03).
        { name: "idx_doctor_status_speciality", fields: ["speciality", "status"] },
      ],
    }
  );

  return doctor_queue_status;
};
