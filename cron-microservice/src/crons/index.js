const { CronRunner } = require("./runner");
const { parseBoolean, parseList } = require("../config");
const { runDailyOperationsReport } = require("./jobs/daily-operations-report.job");
const { runVisitQueueSync } = require("./jobs/visit-queue-sync.job");
const { runDdxWorker } = require("./jobs/ddx-worker.job");

const cronDefinitions = (env = process.env) => [
  {
    name: "daily-operations-report",
    schedule: env.DAILY_REPORT_CRON || "55 23 * * *",
    flag: "DAILY_REPORT_CRON_ENABLED",
    enabled: parseBoolean(env.DAILY_REPORT_CRON_ENABLED, true),
    timezone: env.CRON_TIMEZONE || "UTC",
    task: runDailyOperationsReport,
  },
  {
    name: "visit-queue-sync",
    schedule: env.AI_VISIT_CRON_TIMINGS_DDX_QUEUE || "*/30 * * * * *",
    flag: "AI_DDX_PIPELINE_ENABLED",
    enabled: parseBoolean(env.AI_DDX_PIPELINE_ENABLED, false),
    task: runVisitQueueSync,
  },
  {
    name: "ddx-worker",
    schedule: env.AI_VISIT_CRON_TIMINGS_DDX_CALL || "*/30 * * * * *",
    flag: "AI_DDX_PIPELINE_ENABLED",
    enabled: parseBoolean(env.AI_DDX_PIPELINE_ENABLED, false),
    task: runDdxWorker,
  },
];

const disabledReason = (definition, { allEnabled, only, disabled }) => {
  if (!allEnabled) return "CRONS_ENABLED=false";
  if (disabled.includes(definition.name)) return "listed in CRONS_DISABLED";
  if (only.length && !only.includes(definition.name)) return "not listed in CRONS_ONLY";
  if (!definition.enabled) return `${definition.flag}=false`;
  return null;
};

const selectCrons = (definitions, env = process.env) => {
  const only = parseList(env.CRONS_ONLY);
  const disabled = parseList(env.CRONS_DISABLED);
  const known = new Set(definitions.map(({ name }) => name));
  const unknown = [...only, ...disabled].filter((name) => !known.has(name));
  if (unknown.length) {
    throw new Error(`Unknown cron in CRONS_ONLY/CRONS_DISABLED: ${unknown.join(", ")} (known: ${[...known].join(", ")})`);
  }

  const allEnabled = parseBoolean(env.CRONS_ENABLED, true);
  return definitions.map(({ flag, ...definition }) => {
    const reason = disabledReason({ ...definition, flag }, { allEnabled, only, disabled });
    return { ...definition, enabled: !reason, disabledReason: reason };
  });
};

const createCronRunner = ({ logger = console, env = process.env } = {}) => {
  const runner = new CronRunner({ logger });
  for (const definition of selectCrons(cronDefinitions(env), env)) runner.register(definition);
  return runner;
};

module.exports = { createCronRunner, cronDefinitions, selectCrons };
