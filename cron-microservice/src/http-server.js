const http = require("node:http");
const { numberFromEnv } = require("./config");

const writeJson = (response, statusCode, body) => {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const createHttpServer = ({ runner, database }) => http.createServer(async (request, response) => {
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

  writeJson(response, 404, { error: "Not found" });
});

const listen = (server) => new Promise((resolve, reject) => {
  const port = numberFromEnv(process.env.PORT, 3010);
  server.once("error", reject);
  server.listen(port, "0.0.0.0", () => resolve(port));
});

module.exports = { createHttpServer, listen };
