"use strict";
const { Model } = require("sequelize");

/**
 * queue_entries — one row per visit that enters the specialty queue.
 * Position within a specialty = ORDER BY priority DESC, enqueuedAt ASC among WAITING.
 */
module.exports = (sequelize, DataTypes) => {
  class QueueEntry extends Model {}

  QueueEntry.init(
    {
      visitUuid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // a visit is in the queue at most once
      },
      patientId: DataTypes.STRING,
      patientName: DataTypes.STRING,
      specialty: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM,
        values: ["WAITING", "ASSIGNED", "IN_CALL", "COMPLETED", "CANCELLED", "STALE"],
        defaultValue: "WAITING",
      },
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0, // higher = more urgent
      },
      doctorId: DataTypes.STRING,
      roomId: DataTypes.STRING, // LiveKit room, set when the call starts
      enqueuedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      assignedAt: DataTypes.DATE,
      startedAt: DataTypes.DATE, // call started
      completedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "QueueEntry",
      tableName: "queue_entries",
      indexes: [
        // the claim/position/list queries all hit this composite index
        // (visitUuid already gets a unique index from `unique: true` above)
        { name: "idx_specialty_status_order", fields: ["specialty", "status", "priority", "enqueuedAt"] },
      ],
    }
  );

  return QueueEntry;
};
