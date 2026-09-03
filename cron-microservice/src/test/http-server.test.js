const test = require("node:test");
const assert = require("node:assert/strict");
const { createHttpServer } = require("../http-server");

test("serves health and readiness from the independent HTTP service", async () => {
  const runner = { status: () => [{ name: "daily-operations-report", running: false }] };
  const database = { authenticate: async () => {} };
  const server = createHttpServer({ runner, database });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
    const readiness = await fetch(`http://127.0.0.1:${port}/ready`).then((response) => response.json());
    assert.equal(health.service, "cron-microservice");
    assert.equal(health.crons[0].name, "daily-operations-report");
    assert.equal(readiness.status, "ready");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
