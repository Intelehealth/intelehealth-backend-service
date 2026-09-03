const moment = require("moment-timezone");

const SQL_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const { CronReportRepository } = require("../../database/cron-report.repository");
const { collectDatabaseMetrics, collectS3Metrics } = require("../services/report-metrics.service");
const { collectGaMetrics } = require("../services/report-ga.service");
const { buildMessage, buildSlackPayload, sendSlackReport } = require("../services/report-slack.service");
const { parseBoolean } = require("../../config");
const { withAdvisoryLock, DAILY_REPORT_LOCK } = require("../../database/advisory-lock");

const reportPeriod = (now = moment()) => {
  const timezone = process.env.CRON_TIMEZONE || "UTC";
  if (!moment.tz.zone(timezone)) throw new Error(`Invalid CRON_TIMEZONE: ${timezone}`);
  const end = now.clone().tz(timezone);
  return {
    timezone,
    reportDate: end.format("YYYY-MM-DD"),
    start: end.clone().startOf("day"),
    end,
  };
};

const runDailyOperationsReport = async ({ now, force = false, dependencies = {} } = {}) => {
  const withLock = dependencies.withLock
    || ((run) => withAdvisoryLock(DAILY_REPORT_LOCK, run));
  return withLock(() => collectAndDeliver({ now, force, dependencies }));
};

const collectAndDeliver = async ({ now, force, dependencies }) => {
  const period = reportPeriod(now);
  const repository = dependencies.repository || new CronReportRepository();
  const [report, created] = await repository.findOrCreate({
    reportDate: period.reportDate,
    timezone: period.timezone,
    periodStart: period.start.format(SQL_DATETIME_FORMAT),
    periodEnd: period.end.format(SQL_DATETIME_FORMAT),
  });

  /*
    Idempotency is on a completed report, not on the row existing. A run that
    failed part-way leaves a row behind, and keying on existence would make the
    failure permanent for that date until someone passed --force.
  */
  if (!created && report.status === "completed" && !force) return { skipped: true, report };
  if (!created) await report.update({ status: "running", error: null });

  try {
    const collectDatabase = dependencies.collectDatabaseMetrics || collectDatabaseMetrics;
    const collectS3 = dependencies.collectS3Metrics || collectS3Metrics;
    const collectGa = dependencies.collectGaMetrics || collectGaMetrics;
    const [database, s3, ga] = await Promise.all([
      collectDatabase(period, dependencies),
      collectS3(period, dependencies),
      collectGa(period, dependencies),
    ]);
    const metrics = [...database, ...s3, ...ga];
    const debug = parseBoolean(process.env.DAILY_REPORT_SLACK_DEBUG);
    const message = buildMessage({ ...period, metrics });
    const slackPayload = buildSlackPayload({ ...period, metrics, debug });

    await report.update({ message, metrics, slack_payload: slackPayload });
    const deliver = dependencies.sendSlackReport || sendSlackReport;
    const slackStatus = await deliver(slackPayload, dependencies);
    await report.update({ status: "completed", slack_status: slackStatus });
    return report;
  } catch (error) {
    await report.update({ status: "failed", slack_status: "failed", error: error.message });
    throw error;
  }
};

module.exports = { runDailyOperationsReport, reportPeriod };
