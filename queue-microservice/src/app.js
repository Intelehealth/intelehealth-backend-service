const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const swaggerUi = require("swagger-ui-express");

const routes = require("./routes");
const openapi = require("./docs/openapi");
const models = require("./models");
const config = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { success } = require("./utils/apiResponse");

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging without patient data: method, path, status, duration only.
app.use(
  morgan(":method :url :status :response-time ms", {
    skip: (req) => req.path === "/health",
  })
);

/** Public: liveness + a DB round-trip so a broken connection shows up here. */
app.get("/health", async (_req, res) => {
  let database = "up";
  try {
    await models.sequelize.authenticate();
  } catch (_) {
    database = "down";
  }
  return success(res, {
    service: "queue-microservice",
    status: database === "up" ? "ok" : "degraded",
    database,
    queueScope: config.queue.scope,
    criticalLaneScope: config.queue.criticalLaneScope,
    jobsEnabled: config.jobs.enabled,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Public: the shared API contract (LLD §13.6).
app.get("/api-docs.json", (_req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "Intelehealth QMS API" }));

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
