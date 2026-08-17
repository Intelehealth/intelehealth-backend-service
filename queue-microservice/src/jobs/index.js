const cron = require("node-cron");

const config = require("../config/env");
const logger = require("../utils/logger");
const { runAgingTick } = require("./aging.job");
const { runSlaTick } = require("./slaPromote.job");
const { runSweepTick } = require("./sweep.job");
const { runAccuracyTick } = require("./accuracyAlert.job");

/**
 * Background job scheduling.
 *
 * Cadences follow the specs: aging every 5 minutes (Priority Engine §03 — a
 * best-effort cadence, since correctness does not depend on it), SLA
 * force-promote every 1 minute (§04), plus the housekeeping sweeps and the
 * accuracy watchdog (LLD §13.4).
 *
 * Each job is wrapped so a failure logs and the schedule survives, and an
 * overlap guard keeps a slow tick from stacking on top of itself.
 */
const tasks = [];
const running = new Set();

const guarded = (name, fn) => async () => {
  if (running.has(name)) {
    logger.warn("Skipping job tick — previous run still in flight", { job: name });
    return;
  }
  running.add(name);
  const started = Date.now();
  try {
    await fn();
  } catch (err) {
    logger.error("Job failed", { job: name, error: err.message });
  } finally {
    running.delete(name);
    logger.debug("Job tick finished", { job: name, ms: Date.now() - started });
  }
};

const schedule = (name, expression, fn) => {
  if (!cron.validate(expression)) {
    logger.error("Invalid cron expression — job not scheduled", { job: name, expression });
    return;
  }
  const task = cron.schedule(expression, guarded(name, fn));
  tasks.push({ name, task });
  logger.info("Job scheduled", { job: name, cron: expression });
};

const start = () => {
  if (!config.jobs.enabled) {
    logger.warn("Background jobs are disabled (JOBS_ENABLED=false)");
    return;
  }
  schedule("aging", config.jobs.agingCron, runAgingTick);
  schedule("sla-promote", config.jobs.slaCron, runSlaTick);
  schedule("sweep", config.jobs.sweepCron, runSweepTick);
  if (config.accuracyAlert.enabled) {
    schedule("accuracy-alert", config.jobs.accuracyCron, runAccuracyTick);
  }
};

const stop = () => {
  for (const { name, task } of tasks) {
    task.stop();
    logger.debug("Job stopped", { job: name });
  }
  tasks.length = 0;
};

module.exports = { start, stop, runAgingTick, runSlaTick, runSweepTick, runAccuracyTick };
