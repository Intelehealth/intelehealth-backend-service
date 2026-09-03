const moment = require("moment-timezone");

const SQL_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const { CronReportRepository } = require("../../database/cron-report.repository");
const { collectDatabaseMetrics, collectS3Metrics } = require("../services/report-metrics.service");
const { collectGaMetrics } = require("../services/report-ga.service");
const { buildSlackPayload, sendSlackReport } = require("../services/report-slack.service");
const { withAdvisoryLock, DAILY_REPORT_LOCK } = require("../../database/advisory-lock");

/*
  Only the counts are persisted. Labels, sections, sources and units all come
  from the metric configuration, so storing them would copy the config into every
  row and freeze wording that is meant to be editable. Per-location breakdowns
  are kept because they are measurements, not configuration, and cannot be
  recovered once the bucket is pruned.
*/
const persistableMetrics = (metrics) => {
  const counts = {};
  const breakdowns = {};
  for (const metric of metrics) {
    counts[metric.name] = metric.value;
    if (metric.breakdown && Object.keys(metric.breakdown).length) {
      breakdowns[metric.name] = metric.breakdown;
    }
  }
  return Object.keys(breakdowns).length ? { counts, breakdowns } : { counts };
};

/*
  A source that is down must not cost the whole report. GA4 in particular is a
  third party reached over the network - a revoked key or a quota error at 23:55
  would otherwise discard the database and S3 numbers that were collected fine.
  Sources are settled independently, whatever succeeded is delivered, and the
  ones that failed are named in the message so a missing metric is never read as
  a zero. Only a total failure aborts.
*/
const errorText = (reason) => (reason instanceof Error ? reason.message : String(reason));
const describeFailure = ({ source, message }) => `${source}: ${message}`;

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
    const sources = [
      { name: "Databases", collect: dependencies.collectDatabaseMetrics || collectDatabaseMetrics },
      { name: "S3", collect: dependencies.collectS3Metrics || collectS3Metrics },
      { name: "GA4", collect: dependencies.collectGaMetrics || collectGaMetrics },
    ];
    const settled = await Promise.allSettled(
      sources.map(({ collect }) => collect(period, dependencies))
    );

    const metrics = [];
    const failures = [];
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") metrics.push(...result.value);
      else failures.push({ source: sources[index].name, message: errorText(result.reason) });
    });
    if (!metrics.length) {
      throw new Error(`No metric source succeeded: ${failures.map(describeFailure).join("; ")}`);
    }
    const slackPayload = buildSlackPayload({ ...period, metrics, failures });

    await report.update({ metrics: persistableMetrics(metrics) });
    const deliver = dependencies.sendSlackReport || sendSlackReport;
    const slackStatus = await deliver(slackPayload, dependencies);
    await report.update({
      status: failures.length ? "partial" : "completed",
      slack_status: slackStatus,
      error: failures.length ? failures.map(describeFailure).join("; ") : null,
    });
    return report;
  } catch (error) {
    await report.update({ status: "failed", slack_status: "failed", error: error.message });
    throw error;
  }
};

module.exports = { runDailyOperationsReport, reportPeriod };
