const { database } = require("./index");

const DAILY_REPORT_LOCK = "cron_microservice_daily_report";

/*
  The service runs on several hosts, so a scheduled job fires on each of them at
  the same moment. The unique key on cron_reports stops the duplicate row, but
  not the duplicate work: every instance would still query the databases, list
  the bucket and post its own Slack message.

  GET_LOCK is held for the length of the run on one pooled connection, the same
  way the migration runner holds its lock, so exactly one instance proceeds. The
  timeout is 0 because a loser has nothing useful to do afterwards - waiting and
  then running would reproduce the duplicate it was meant to prevent.
*/
const withAdvisoryLock = async (name, run, pool = database) => {
  const connection = await pool.getConnection();
  let acquired = false;
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK(:name, 0) AS acquired", { name });
    acquired = Number(lock.acquired) === 1;
    if (!acquired) return { skipped: true, reason: "locked" };
    return await run();
  } finally {
    if (acquired) await connection.query("SELECT RELEASE_LOCK(:name)", { name });
    connection.release();
  }
};

module.exports = { withAdvisoryLock, DAILY_REPORT_LOCK };
