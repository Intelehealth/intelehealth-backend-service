"use strict";
const cron = require("node-cron");
const { sequelize, Sequelize, QueueEntry } = require("../models");
const { Op } = Sequelize;

/**
 * Safety net: if a client crashes mid-call, `complete` (stopRecording) may never
 * arrive and the entry would stay IN_CALL forever. This sweep marks IN_CALL entries
 * older than STALE_AFTER_MINUTES as STALE.
 *
 * NOTE: the more reliable signal is a LiveKit `room_finished` webhook — wire that up
 * in web-rtc when ready. Until then this time-based sweep prevents stuck entries.
 */
function startStaleSweep() {
  const minutes = Number(process.env.STALE_AFTER_MINUTES || 30);

  // every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      const [count] = await QueueEntry.update(
        { status: "STALE" },
        { where: { status: "IN_CALL", startedAt: { [Op.lt]: cutoff } } }
      );
      if (count > 0) console.log(`[qms] stale sweep: marked ${count} stuck IN_CALL entries STALE`);
    } catch (err) {
      console.error("[qms] stale sweep error:", err.message);
    }
  });

  console.log(`[qms] stale sweep scheduled (IN_CALL > ${minutes}min)`);
}

module.exports = { startStaleSweep };
