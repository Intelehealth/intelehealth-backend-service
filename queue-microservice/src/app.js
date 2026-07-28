"use strict";
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const authMiddleware = require("./middleware/auth");
const queueRoutes = require("./routes/queue.routes");
const swaggerDocument = require("../swagger.json");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// API docs — http://localhost:<PORT>/api-docs (use the Authorize button to set x-qms-secret)
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    explorer: true,
    swaggerOptions: { docExpansion: "none", persistAuthorization: true },
  })
);

// health check (no auth)
app.get("/health", (req, res) => res.json({ success: true, service: "queue-microservice" }));

// everything under /queue requires auth: a valid user JWT, or the x-qms-secret
// header for internal service-to-service calls (web-rtc, portal)
app.use("/queue", authMiddleware, queueRoutes);

// 404
app.use((req, res) => res.status(404).json({ success: false, message: "Not found." }));

module.exports = app;
