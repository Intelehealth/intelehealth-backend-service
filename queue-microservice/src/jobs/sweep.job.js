const { Op } = require("sequelize");

const models = require("../models");
const config = require("../config/env");
const logger = require("../utils/logger");
const queueService = require("../services/queue.service");
const { STATUS, WAITING_STATUSES } = require("../constants");

/**
 * Housekeeping sweeps.
 *
 * Three things can otherwise leave an entry stranded forever:
 *
 *   • a health worker's app is killed while the case is still waiting
 *     (LLD §09.1 heartbeat),
 *   • a case is assigned but the call never starts (LLD §04's RE_QUEUED path),
 *   • a call connects and the client crashes before anything reports it
 *     finished. Completion is client-driven, so without this sweep the entry
 *     stays CONNECTED and the doctor stays in_consult indefinitely.
 */

/**
 * A missing heartbeat FLAGS the entry for review — it never auto-cancels it.
 * The doc is explicit about why: a patient may still be waiting even if the app
 * died, so a machine must not decide they have gone home.
 *
 * There is nothing to write: "flagged" is simply last_heartbeat_at being older
 * than the cutoff, computed wherever it is read. So this pass only reports the
 * count, which is what a human would act on anyway.
 */
const sweepHeartbeats = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - config.queue.heartbeatStaleMinutes * 60000);

  const stale = await models.queue_entries.count({
    where: {
      status: { [Op.in]: WAITING_STATUSES },
      lastHeartbeatAt: { [Op.lt]: cutoff },
    },
  });

  if (stale) {
    logger.warn("Waiting entries with a stale heartbeat — review, do not cancel", { stale });
  }
  return stale;
};

/** Assigned or connecting but never actually connected — back to the queue. */
const sweepStuckConnections = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - config.queue.connectingTimeoutMinutes * 60000);

  const stuck = await models.queue_entries.findAll({
    where: {
      status: { [Op.in]: [STATUS.ASSIGNED, STATUS.CALL_CONNECTING] },
      assignedAt: { [Op.lt]: cutoff },
    },
    limit: config.jobs.batchSize,
  });

  let requeued = 0;
  for (const entry of stuck) {
    try {
      await queueService.requeue(entry.id, { reason: "CONNECTION_TIMEOUT" });
      requeued += 1;
    } catch (err) {
      logger.warn("Could not re-queue stuck case", { queueEntryId: entry.id, error: err.message });
    }
  }

  if (requeued) logger.warn("Stuck connections re-queued", { requeued });
  return requeued;
};

/**
 * Connected, but nothing ever reported the call finished. Closing these moves
 * the case on to awaiting its prescription, so the doctor is freed once that is
 * shared rather than being pinned to a call that is no longer happening.
 */
const sweepStaleCalls = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - config.queue.staleAfterMinutes * 60000);

  const stale = await models.queue_entries.findAll({
    where: { status: STATUS.CALL_CONNECTED, connectedAt: { [Op.lt]: cutoff } },
    limit: config.jobs.batchSize,
  });

  let closed = 0;
  for (const entry of stale) {
    try {
      // Deliberately NOT queueService.complete(): a swept session is not a
      // real completion, and its fabricated duration would poison the
      // avg_consult_min EMA that feeds μ (§07). Close the record, free the
      // doctor, leave μ alone — and say so in the log, which is where a swept
      // close is recorded now that the row carries no source column.
      //
      // It lands in CALL_COMPLETED, never PRESCRIPTION_COMPLETED: the sweep
      // knows the call stopped, and knows nothing whatsoever about whether a
      // prescription was written. Marking the visit finished here would have a
      // timeout job assert a clinical act that may never have happened.
      //
      // The doctor stays in_consult: they go online once the prescription is
      // shared, as with any other finished call.
      logger.warn("Closing a call that never reported finishing", { queueEntryId: entry.id });
      await entry.update({ status: STATUS.CALL_COMPLETED, callEndedAt: now });
      closed += 1;
    } catch (err) {
      logger.warn("Could not close stale call", { queueEntryId: entry.id, error: err.message });
    }
  }

  if (closed) logger.warn("Stale calls closed", { closed, afterMinutes: config.queue.staleAfterMinutes });
  return closed;
};

const runSweepTick = async ({ now = new Date() } = {}) => {
  const staleHeartbeats = await sweepHeartbeats(now);
  const requeued = await sweepStuckConnections(now);
  const closed = await sweepStaleCalls(now);
  return { staleHeartbeats, requeued, closed };
};

module.exports = { runSweepTick, sweepHeartbeats, sweepStuckConnections, sweepStaleCalls };
