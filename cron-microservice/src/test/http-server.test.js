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

test("the manual trigger route does not exist without a token configured", async () => {
  const server = createHttpServer({
    runner: { status: () => [], runNow: async () => assert.fail("must not be called") },
    database: { authenticate: async () => {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/internal/crons/daily-operations-report/run`, {
      method: "POST",
    });
    assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the manual trigger route requires its own token and forwards force", async () => {
  const previousToken = process.env.CRON_TRIGGER_TOKEN;
  process.env.CRON_TRIGGER_TOKEN = "trigger-secret";
  const calls = [];
  const server = createHttpServer({
    runner: {
      status: () => [],
      runNow: async (name, options) => { calls.push({ name, options }); return { status: "completed" }; },
    },
    database: { authenticate: async () => {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/internal/crons/daily-operations-report/run`;

  try {
    const denied = await fetch(url, { method: "POST" });
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${url}?force=true`, {
      method: "POST",
      headers: { "x-cron-trigger-token": "trigger-secret" },
    });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), {
      triggered: "daily-operations-report", force: true, result: { status: "completed" },
    });
    assert.deepEqual(calls, [{ name: "daily-operations-report", options: { force: true } }]);
  } finally {
    if (previousToken == null) delete process.env.CRON_TRIGGER_TOKEN;
    else process.env.CRON_TRIGGER_TOKEN = previousToken;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the manual trigger route reports a run already in progress and an unknown cron distinctly", async () => {
  const previousToken = process.env.CRON_TRIGGER_TOKEN;
  process.env.CRON_TRIGGER_TOKEN = "trigger-secret";
  const server = createHttpServer({
    runner: {
      status: () => [],
      runNow: async (name) => {
        if (name === "busy") return { alreadyRunning: true };
        throw new Error(`Unknown cron: ${name}`);
      },
    },
    database: { authenticate: async () => {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const headers = { "x-cron-trigger-token": "trigger-secret" };

  try {
    const busy = await fetch(`http://127.0.0.1:${port}/internal/crons/busy/run`, { method: "POST", headers });
    assert.equal(busy.status, 409);

    const unknown = await fetch(`http://127.0.0.1:${port}/internal/crons/nope/run`, { method: "POST", headers });
    assert.equal(unknown.status, 404);
  } finally {
    if (previousToken == null) delete process.env.CRON_TRIGGER_TOKEN;
    else process.env.CRON_TRIGGER_TOKEN = previousToken;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the manual trigger response is always JSON-serializable, even when the job returns a live record", async () => {
  const previousToken = process.env.CRON_TRIGGER_TOKEN;
  process.env.CRON_TRIGGER_TOKEN = "trigger-secret";
  const circular = { query: async () => {} };
  circular.self = circular;
  const { CronReportRecord } = require("../database/cron-report.repository");
  const record = new CronReportRecord({ id: 1, status: "completed" }, circular);

  const server = createHttpServer({
    runner: { status: () => [], runNow: async () => record },
    database: { authenticate: async () => {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/internal/crons/daily-operations-report/run`, {
      method: "POST",
      headers: { "x-cron-trigger-token": "trigger-secret" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      triggered: "daily-operations-report", force: false, result: { id: 1, status: "completed" },
    });
  } finally {
    if (previousToken == null) delete process.env.CRON_TRIGGER_TOKEN;
    else process.env.CRON_TRIGGER_TOKEN = previousToken;
    await new Promise((resolve) => server.close(resolve));
  }
});
