"use strict";
const { sequelize, Sequelize, QueueEntry } = require("../models");
const { Op } = Sequelize;

/**
 * Add a visit to the queue. Idempotent on visitUuid — re-enqueuing an existing
 * visit just returns the current row instead of creating a duplicate.
 */
async function enqueue({ visitUuid, patientId, patientName, specialty, priority = 0 }) {
  const [entry] = await QueueEntry.findOrCreate({
    where: { visitUuid },
    defaults: { visitUuid, patientId, patientName, specialty, priority, status: "WAITING" },
  });
  return entry;
}

/**
 * Atomically claim the next waiting patient for a specialty.
 *
 * FOR UPDATE SKIP LOCKED: if two doctors call this at the same moment, each locks
 * a different row — the second one skips the row the first has locked and takes the
 * next patient. No double-booking, no waiting. Requires MySQL 8.0.1+.
 */
async function claimNext(specialty, doctorId) {
  return sequelize.transaction(async (t) => {
    const entry = await QueueEntry.findOne({
      where: { specialty, status: "WAITING" },
      order: [["priority", "DESC"], ["enqueuedAt", "ASC"]],
      lock: t.LOCK.UPDATE,
      skipLocked: true,
      transaction: t,
    });

    if (!entry) return null; // queue empty

    entry.status = "ASSIGNED";
    entry.doctorId = doctorId;
    entry.assignedAt = new Date();
    await entry.save({ transaction: t });
    return entry;
  });
}

/**
 * Claim a specific entry the doctor picked from the list.
 * Compare-and-swap: only succeeds if it is still WAITING, otherwise someone
 * else already took it — caller should fall back to claimNext().
 */
async function claimById(id, doctorId) {
  const [count] = await QueueEntry.update(
    { status: "ASSIGNED", doctorId, assignedAt: new Date() },
    { where: { id, status: "WAITING" } }
  );
  if (count === 0) return null; // already taken
  return QueueEntry.findByPk(id);
}

/** Mark the call as started (driven by WebRTC startRecording). */
async function markInCall({ visitUuid, doctorId, roomId }) {
  const [count] = await QueueEntry.update(
    { status: "IN_CALL", doctorId, roomId, startedAt: new Date() },
    { where: { visitUuid, status: { [Op.in]: ["WAITING", "ASSIGNED"] } } }
  );
  return count > 0;
}

/**
 * Mark the call/visit complete (driven by WebRTC stopRecording or webhook).
 * Accepts either visitUuid or roomId — stopRecording only knows the roomId,
 * which was stored on the entry when the call started (markInCall).
 */
async function complete({ visitUuid, roomId }) {
  const key = visitUuid ? { visitUuid } : { roomId };
  const [count] = await QueueEntry.update(
    { status: "COMPLETED", completedAt: new Date() },
    { where: { ...key, status: { [Op.in]: ["ASSIGNED", "IN_CALL"] } } }
  );
  return count > 0;
}

/** Is this visit currently in a call? (busy check) */
async function isBusy(visitUuid) {
  const active = await QueueEntry.findOne({ where: { visitUuid, status: "IN_CALL" } });
  return !!active;
}

/** Average consult time (seconds) for a specialty, from completed history. */
async function avgConsultSeconds(specialty) {
  const fallback = Number(process.env.DEFAULT_CONSULT_SECONDS || 480);
  const [rows] = await sequelize.query(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, startedAt, completedAt)) AS avgSec
       FROM queue_entries
      WHERE specialty = :specialty AND status = 'COMPLETED'
        AND startedAt IS NOT NULL AND completedAt IS NOT NULL`,
    { replacements: { specialty } }
  );
  const avg = rows && rows[0] && rows[0].avgSec;
  return avg ? Math.round(avg) : fallback;
}

/**
 * Position of a visit in its specialty queue + estimated wait.
 * position 1 == next to be seen.
 */
async function position(visitUuid) {
  const me = await QueueEntry.findOne({ where: { visitUuid } });
  if (!me) return null;
  if (me.status !== "WAITING") {
    return { visitUuid, status: me.status, position: 0, aheadCount: 0, estimatedWaitSeconds: 0 };
  }

  const aheadCount = await QueueEntry.count({
    where: {
      specialty: me.specialty,
      status: "WAITING",
      [Op.or]: [
        { priority: { [Op.gt]: me.priority } },
        { priority: me.priority, enqueuedAt: { [Op.lt]: me.enqueuedAt } },
      ],
    },
  });

  const avgSec = await avgConsultSeconds(me.specialty);
  return {
    visitUuid,
    status: me.status,
    position: aheadCount + 1,
    aheadCount,
    estimatedWaitSeconds: aheadCount * avgSec,
  };
}

/** Pending list + counts for a specialty (health-worker / doctor dashboard). */
async function listBySpecialty(specialty) {
  const waiting = await QueueEntry.findAll({
    where: { specialty, status: { [Op.in]: ["WAITING", "ASSIGNED"] } },
    order: [["priority", "DESC"], ["enqueuedAt", "ASC"]],
  });
  const inCallCount = await QueueEntry.count({ where: { specialty, status: "IN_CALL" } });
  return {
    specialty,
    waitingCount: waiting.filter((e) => e.status === "WAITING").length,
    assignedCount: waiting.filter((e) => e.status === "ASSIGNED").length,
    inCallCount,
    entries: waiting,
  };
}

module.exports = {
  enqueue,
  claimNext,
  claimById,
  markInCall,
  complete,
  isBusy,
  position,
  listBySpecialty,
  avgConsultSeconds,
};
