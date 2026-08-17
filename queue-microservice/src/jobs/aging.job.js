const { Op } = require("sequelize");

const models = require("../models");
const config = require("../config/env");
const logger = require("../utils/logger");
const priority = require("../services/priority.service");
const priorityConfig = require("../services/priorityConfig.service");
const notification = require("../services/notification.service");
const { WAITING_STATUSES } = require("../constants");

/**
 * The aging job — Priority Engine Algorithm Spec §03.
 *
 * The naive version (re-apply the current tier's rate on every tick) has two
 * real bugs the spec calls out:
 *
 *   1. Missed ticks under-age a case. If the job is delayed by a restart or a
 *      slow cycle, or a tick straddles a tier boundary, blindly adding "the
 *      current tier's rate" mis-applies the bonus for that window.
 *   2. Aging a claimed case resurrects it. On Redis, ZINCRBY against a member
 *      that no longer exists silently re-creates it with the increment as its
 *      score, so a case claimed between the job's snapshot and its write pops
 *      back into the queue with a wrong score.
 *
 * Both fixes are here:
 *
 *   • cumulative_aging_applied is stored per case; every tick recomputes the
 *     total due from the closed form W(m) and applies only the delta. Idempotent
 *     regardless of how irregularly the job actually runs — the cadence is a
 *     performance knob, not a correctness dependency.
 *   • the write is a single conditional UPDATE guarded on the case still being
 *     in a waiting status. On MySQL that is the whole fix: an UPDATE whose
 *     WHERE clause no longer matches affects zero rows and cannot re-create a
 *     claimed case, so there is no resurrection window at all.
 */
const runAgingTick = async ({ now = new Date(), batchSize = config.jobs.batchSize } = {}) => {
  const cfg = priorityConfig.get();
  const stats = { scanned: 0, aged: 0, skipped: 0, lanes: new Set() };

  let lastId = 0;
  for (;;) {
    const batch = await models.queue_entries.findAll({
      where: { status: { [Op.in]: WAITING_STATUSES }, id: { [Op.gt]: lastId } },
      order: [["id", "ASC"]],
      limit: batchSize,
    });
    if (!batch.length) break;
    lastId = batch[batch.length - 1].id;

    for (const entry of batch) {
      stats.scanned += 1;
      const { totalDue, delta } = priority.agingDelta(entry, now, cfg);
      if (!(delta > 0)) {
        stats.skipped += 1;
        continue;
      }

      // Recompute rather than increment: priority_score is always
      // base_score + the aging due, so a torn or repeated tick self-heals.
      const [affected] = await models.queue_entries.update(
        {
          priorityScore: models.sequelize.literal(`base_score + ${Number(totalDue)}`),
          cumulativeAgingApplied: totalDue,
        },
        {
          where: {
            id: entry.id,
            // Claimed or cancelled since the snapshot — skip, don't resurrect.
            status: { [Op.in]: WAITING_STATUSES },
          },
        }
      );

      if (affected === 0) {
        stats.skipped += 1;
        continue;
      }
      stats.aged += 1;
      stats.lanes.add(
        config.queue.scope === "SPECIALITY_LOCATION"
          ? JSON.stringify({ speciality: entry.speciality, locationUuid: entry.locationUuid })
          : JSON.stringify({ speciality: entry.speciality })
      );
    }

    if (batch.length < batchSize) break;
  }

  // Positions may have moved — let the §08 tiering decide who hears about it.
  for (const lane of stats.lanes) notification.scheduleLaneUpdate(JSON.parse(lane));

  const summary = { scanned: stats.scanned, aged: stats.aged, skipped: stats.skipped };
  if (stats.aged) logger.info("Aging tick applied", summary);
  else logger.debug("Aging tick — nothing due", summary);

  return summary;
};

module.exports = { runAgingTick };
