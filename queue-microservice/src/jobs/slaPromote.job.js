const { Op } = require("sequelize");

const models = require("../models");
const config = require("../config/env");
const logger = require("../utils/logger");
const priority = require("../services/priority.service");
const priorityConfig = require("../services/priorityConfig.service");
const queueLane = require("../services/queueLane.service");
const notification = require("../services/notification.service");
const { STATUS, WAITING_STATUSES } = require("../constants");

/**
 * The SLA force-promote job — Priority Engine Algorithm Spec §04,
 * backend LLD §05.3.
 *
 * A safety net independent of score: if a case sits longer than its type's cap
 * it jumps to the front regardless of arithmetic. This — not the aging curve —
 * is the actual anti-starvation guarantee. In practice a case aged past 45
 * minutes is usually already at or near the front from W(m) alone, and this job
 * is a no-op; that is the intended relationship.
 *
 * Two refinements the spec insists on, both implemented here:
 *
 *   • Escalate ONCE. `escalated` is checked and set in the same conditional
 *     write, so a case cannot re-fire the admin notification every minute
 *     forever.
 *   • Don't hardcode the force score. W(m) grows without bound past 45 minutes
 *     by design, so no fixed constant is guaranteed to outrank every possible
 *     aged score. Read the lane's current top score and promote to one above it.
 */
const runSlaTick = async ({ now = new Date(), batchSize = config.jobs.batchSize } = {}) => {
  const cfg = priorityConfig.get();
  const stats = { scanned: 0, escalated: 0 };
  const lanes = new Set();

  // The widest cap in play bounds how far back we have to look.
  const widestCapMin = Math.max(...Object.values(cfg.slaCapsMin).map(Number));
  const cutoff = new Date(now.getTime() - Math.min(...Object.values(cfg.slaCapsMin).map(Number)) * 60000);

  const candidates = await models.queue_entries.findAll({
    where: {
      status: { [Op.in]: WAITING_STATUSES },
      escalated: false,
      queuedAt: { [Op.lt]: cutoff },
    },
    order: [["queuedAt", "ASC"]],
    limit: batchSize,
  });

  for (const entry of candidates) {
    stats.scanned += 1;
    if (!priority.isPastSlaCap(entry, now, cfg)) continue;

    const top = await queueLane.topScore(entry);
    const forcedScore = top + 1;

    const [affected] = await models.queue_entries.update(
      {
        priorityScore: forcedScore,
        // Keep base_score consistent with the forced score so the aging job's
        // recompute (base + W(m)) cannot silently undo the promotion.
        baseScore: models.sequelize.literal(
          `${Number(forcedScore)} - cumulative_aging_applied`
        ),
        status: STATUS.ESCALATED,
        escalated: true,
        escalatedAt: now,
      },
      {
        where: {
          id: entry.id,
          // Escalate once: this is the guard that stops the admin notification
          // re-firing on every subsequent tick.
          escalated: false,
          status: { [Op.in]: WAITING_STATUSES },
        },
      }
    );

    if (affected === 0) continue;

    stats.escalated += 1;
    lanes.add(JSON.stringify({ speciality: entry.speciality, locationUuid: entry.locationUuid }));

    await entry.reload();
    logger.warn("SLA breach — case force-promoted", {
      queueEntryId: entry.id,
      speciality: entry.speciality,
      caseType: entry.caseType,
      emergencyLevel: entry.emergencyLevel,
      waitedMinutes: Math.round(priority.minutesWaited(entry, now)),
      capMinutes: priority.slaCapMinutes(entry.caseType, entry.emergencyLevel, cfg),
    });

    // LLD §08 — an ESCALATED event always pushes immediately regardless of
    // tier. It is rare enough, and important enough, that the tiering rules
    // must not suppress it.
    await notification.notifyEscalated(entry, {
      capMinutes: priority.slaCapMinutes(entry.caseType, entry.emergencyLevel, cfg),
    });
  }

  for (const lane of lanes) notification.scheduleLaneUpdate(JSON.parse(lane));

  if (stats.escalated) logger.info("SLA tick escalated cases", { ...stats, widestCapMin });
  return stats;
};

module.exports = { runSlaTick };
