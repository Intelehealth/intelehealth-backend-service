"use strict";
require("dotenv").config();

const app = require("./app");
const { sequelize } = require("./models");
const { startStaleSweep } = require("./jobs/staleSweep.job");

const PORT = process.env.PORT || 3600;

(async () => {
  try {
    await sequelize.authenticate();
    console.log("[qms] DB connection OK");

    // dev convenience only — use migrations/DDL in production
    if (process.env.DB_SYNC === "true") {
      await sequelize.sync();
      console.log("[qms] DB synced (DB_SYNC=true)");
    }

    startStaleSweep();

    app.listen(PORT, () => console.log(`[qms] queue-microservice listening on :${PORT}`));
  } catch (err) {
    console.error("[qms] failed to start:", err.message);
    process.exit(1);
  }
})();
