require("dotenv").config();

const { close } = require("../database");
const { runDailyOperationsReport } = require("../crons/jobs/daily-operations-report.job");

runDailyOperationsReport({ force: process.argv.includes("--force") })
  .then((result) => console.info(result.skipped ? "Daily report already exists" : "Daily report completed"))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => close());
