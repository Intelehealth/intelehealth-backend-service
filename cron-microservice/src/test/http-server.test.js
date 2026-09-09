const test = require("node:test");
const assert = require("node:assert/strict");
const { createHttpServer } = require("../http-server");

test("serves health and readiness from the independent HTTP service", async () => {
  let authenticationChecks = 0;
  const runner = { status: () => [{ name: "daily-operations-report", running: false }] };
  const database = { authenticate: async () => { authenticationChecks += 1; } };
  const server = createHttpServer({ runner, database });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
    const readiness = await fetch(`http://127.0.0.1:${port}/ready`).then((response) => response.json());
    await fetch(`http://127.0.0.1:${port}/ready`);
    assert.equal(health.service, "cron-microservice");
    assert.equal(health.crons[0].name, "daily-operations-report");
    assert.equal(readiness.status, "ready");
    assert.equal(authenticationChecks, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("protects health APIs when a token is configured", async () => {
  const previousToken = process.env.HEALTHCHECK_TOKEN;
  process.env.HEALTHCHECK_TOKEN = "probe-secret";
  const server = createHttpServer({
    runner: { status: () => [] },
    database: { authenticate: async () => {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const denied = await fetch(`http://127.0.0.1:${port}/ready`);
    const allowed = await fetch(`http://127.0.0.1:${port}/ready`, {
      headers: { "x-healthcheck-token": "probe-secret" },
    });
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { status: "unauthorized" });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
  } finally {
    if (previousToken == null) delete process.env.HEALTHCHECK_TOKEN;
    else process.env.HEALTHCHECK_TOKEN = previousToken;
    await new Promise((resolve) => server.close(resolve));
  }
});
