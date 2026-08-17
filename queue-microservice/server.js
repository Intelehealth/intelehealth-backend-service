const app = require("./src/app");
const models = require("./src/models");
const config = require("./src/config/env");
const logger = require("./src/utils/logger");
const jobs = require("./src/jobs");
const priorityConfig = require("./src/services/priorityConfig.service");
const notification = require("./src/services/notification.service");

let server = null;

const start = async () => {
  try {
    await models.sequelize.authenticate();
    logger.info("Database connected", { database: config.db.name, host: config.db.host });
  } catch (err) {
    logger.error("Database connection failed", { error: err.message });
    process.exit(1);
  }

  if (config.db.sync) {
    // Dev convenience only. Production schema changes go through migrations.
    await models.sequelize.sync({ alter: true });
    logger.warn("DB_SYNC is on — models were synced to the database");
  }

  // Priority Engine §07: fail closed. A config whose weights don't sum to 1.0
  // must stop the service starting, not run silently miscalibrated.
  try {
    await priorityConfig.load(models);
  } catch (err) {
    logger.error("Priority config rejected — refusing to start", {
      error: err.message,
      details: err.details,
    });
    process.exit(1);
  }

  jobs.start();

  server = app.listen(config.port, () => {
    logger.info("QMS listening", { port: config.port, env: config.env });
  });
};

const shutdown = (signal) => async () => {
  logger.info("Shutting down", { signal });
  jobs.stop();
  notification.shutdown();
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    await models.sequelize.close();
  } catch (_) {
    /* already closed */
  }
  process.exit(0);
};

process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { error: reason?.message || String(reason) });
});

start();
