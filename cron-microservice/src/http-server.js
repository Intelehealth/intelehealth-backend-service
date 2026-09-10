const http = require("node:http");
const crypto = require("node:crypto");
const { numberFromEnv } = require("./config");

const writeJson = (response, statusCode, body) => {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const TRIGGER_PATH = /^\/internal\/crons\/([a-z0-9-]+)\/run$/;

/*
  This endpoint has real side effects - it queries every database, hits GA and
  S3, and can post to Slack - so it fails closed: with no CRON_TRIGGER_TOKEN
  configured the route does not exist at all, rather than defaulting open.
*/
const triggerAuth = (request) => {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) return "disabled";
  const headerToken = request.headers["x-cron-trigger-token"];
  const authorization = request.headers.authorization || "";
  const presented = headerToken
    || (authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(String(presented));
  const matches = expectedBuffer.length === presentedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, presentedBuffer);
  return matches ? "ok" : "unauthorized";
};

const createHttpServer = ({ runner, database }) => {
  const runTrigger = async (response, cronName, force) => {
    try {
      const result = await runner.runNow(cronName, { force });
      if (result && result.alreadyRunning) {
        writeJson(response, 409, { triggered: cronName, alreadyRunning: true });
        return;
      }
      writeJson(response, 200, { triggered: cronName, force, result });
    } catch (error) {
      const status = error.message.startsWith("Unknown cron") ? 404 : 500;
      writeJson(response, status, { triggered: cronName, force, error: error.message });
    }
  };

  return http.createServer(async (request, response) => {
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
      try {
        await database.authenticate();
        writeJson(response, 200, { status: "ready" });
      } catch (error) {
        writeJson(response, 503, { status: "unavailable" });
      }
      return;
    }

    const triggerMatch = request.method === "POST"
      && new URL(request.url, "http://localhost").pathname.match(TRIGGER_PATH);
    if (triggerMatch) {
      const auth = triggerAuth(request);
      if (auth === "disabled") { writeJson(response, 404, { error: "Not found" }); return; }
      if (auth === "unauthorized") { writeJson(response, 401, { status: "unauthorized" }); return; }
      const force = new URL(request.url, "http://localhost").searchParams.get("force") === "true";
      await runTrigger(response, triggerMatch[1], force);
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
