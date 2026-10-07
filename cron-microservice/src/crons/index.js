const { CronRunner } = require("./runner");
const { parseBoolean } = require("../config");
const { runDailyOperationsReport } = require("./jobs/daily-operations-report.job");
const { runVisitQueueSync } = require("./jobs/visit-queue-sync.job");
const { runDdxWorker } = require("./jobs/ddx-worker.job");

const createCronRunner = ({ logger = console } = {}) => {
  const runner = new CronRunner({ logger });
  if (!parseBoolean(process.env.CRONS_ENABLED, true)) return runner;

  runner.register({
    name: "daily-operations-report",
    schedule: process.env.DAILY_REPORT_CRON || "55 23 * * *",
    enabled: parseBoolean(process.env.DAILY_REPORT_CRON_ENABLED, true),
    timezone: process.env.CRON_TIMEZONE || "UTC",
    task: runDailyOperationsReport,
  });

  runner.register({
    name: "visit-queue-sync",
    schedule: process.env.AI_VISIT_CRON_TIMINGS_DDX_QUEUE || "*/30 * * * * *",
    enabled: parseBoolean(process.env.AI_DDX_PIPELINE_ENABLED, false),
    task: runVisitQueueSync,
  });

  runner.register({
    name: "ddx-worker",
    schedule: process.env.AI_VISIT_CRON_TIMINGS_DDX_CALL || "*/30 * * * * *",
    enabled: parseBoolean(process.env.AI_DDX_PIPELINE_ENABLED, false),
    task: runDdxWorker,
  });

  return runner;
};

module.exports = { createCronRunner };
