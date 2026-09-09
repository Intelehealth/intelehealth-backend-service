const { CronRunner } = require("./runner");
const { parseBoolean } = require("../config");
const { runDailyOperationsReport } = require("./jobs/daily-operations-report.job");

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
  return runner;
};

module.exports = { createCronRunner };
