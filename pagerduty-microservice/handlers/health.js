const crypto = require("node:crypto");
const express = require("express");

const cacheTtl = () => {
  const configured = Number(process.env.HEALTHCHECK_CACHE_TTL_MS || 5000);
  return Math.min(Math.max(Number.isFinite(configured) ? configured : 5000, 1000), 60000);
};

const presentedToken = (request) => {
  const headerToken = request.get("x-healthcheck-token");
  if (headerToken) return headerToken;
  const authorization = request.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
};

const tokenMatches = (request) => {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!expected) return true;
  const presented = presentedToken(request);
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(presented);
  return expectedBuffer.length === presentedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, presentedBuffer);
};

const createHealthRouter = ({ service, databases }) => {
  const router = express.Router();
  let cachedReadiness;
  let cacheExpiresAt = 0;
  let pendingReadiness;

  const protect = (request, response, next) => {
    response.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (!tokenMatches(request)) {
      return response.status(401).json({ status: "unauthorized" });
    }
    return next();
  };

  router.get("/health", protect, (request, response) => {
    response.status(200).json({
      status: "healthy",
      service,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  const checkReadiness = async () => {
    const now = Date.now();
    if (cachedReadiness && now < cacheExpiresAt) return cachedReadiness;
    if (pendingReadiness) return pendingReadiness;

    pendingReadiness = Promise.all(Object.entries(databases).map(
      async ([name, connection]) => {
        try {
          await connection.authenticate();
          return [name, "connected"];
        } catch (error) {
          return [name, "disconnected"];
        }
      },
    )).then((checks) => {
      const databaseStatuses = Object.fromEntries(checks);
      const ready = checks.every(([, status]) => status === "connected");
      cachedReadiness = {
        status: ready ? "ready" : "unavailable",
        service,
        databases: databaseStatuses,
        timestamp: new Date().toISOString(),
      };
      cacheExpiresAt = Date.now() + cacheTtl();
      return cachedReadiness;
    }).finally(() => {
      pendingReadiness = undefined;
    });

    return pendingReadiness;
  };

  router.get("/ready", protect, async (request, response) => {
    const readiness = await checkReadiness();
    response.status(readiness.status === "ready" ? 200 : 503).json(readiness);
  });

  return router;
};

module.exports = { createHealthRouter };
