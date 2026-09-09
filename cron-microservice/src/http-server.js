const http = require("node:http");
const crypto = require("node:crypto");
const { numberFromEnv } = require("./config");

const writeJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
};

const tokenMatches = (request) => {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!expected) return true;
  const headerToken = request.headers["x-healthcheck-token"];
  const authorization = request.headers.authorization || "";
  const presented = headerToken
    || (authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(String(presented));
  return expectedBuffer.length === presentedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, presentedBuffer);
};

const cacheTtl = () => {
  const configured = Number(process.env.HEALTHCHECK_CACHE_TTL_MS || 5000);
  const ttl = Number.isFinite(configured) ? configured : 5000;
  return Math.min(Math.max(ttl, 1000), 60000);
};

const createHttpServer = ({ runner, database }) => {
  let cachedReadiness;
  let cacheExpiresAt = 0;
  let pendingReadiness;

  const checkReadiness = async () => {
    const now = Date.now();
    if (cachedReadiness && now < cacheExpiresAt) return cachedReadiness;
    if (pendingReadiness) return pendingReadiness;

    pendingReadiness = database.authenticate()
      .then(() => ({ status: "ready" }))
      .catch(() => ({ status: "unavailable" }))
      .then((readiness) => {
        cachedReadiness = readiness;
        cacheExpiresAt = Date.now() + cacheTtl();
        return readiness;
      })
      .finally(() => {
        pendingReadiness = undefined;
      });
    return pendingReadiness;
  };

  return http.createServer(async (request, response) => {
    if ((request.url === "/health" || request.url === "/ready") && !tokenMatches(request)) {
      writeJson(response, 401, { status: "unauthorized" });
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, {
        status: "ok",
        service: "cron-microservice",
        uptime: process.uptime(),
        crons: runner.status(),
      });
      return;
    }

    if (request.method === "GET" && request.url === "/ready") {
      const readiness = await checkReadiness();
      writeJson(response, readiness.status === "ready" ? 200 : 503, readiness);
      return;
    }

    writeJson(response, 404, { error: "Not found" });
  });
};

const listen = (server) => new Promise((resolve, reject) => {
  const port = numberFromEnv(process.env.PORT, 3010);
  server.once("error", reject);
  server.listen(port, "0.0.0.0", () => resolve(port));
});

module.exports = { createHttpServer, listen };
