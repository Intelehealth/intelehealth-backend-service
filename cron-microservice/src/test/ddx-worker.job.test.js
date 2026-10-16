const test = require("node:test");
const assert = require("node:assert/strict");
const { processQueue } = require("../crons/jobs/ddx-worker.job");
const { notifyDdxStatus } = require("../crons/services/ai-ddx-notify.service");

const run = async (rows, { computeFails = false } = {}) => {
  const notified = [];
  await processQueue(rows.length, {
    claimNext: async () => rows,
    computeForVisit: async () => {
      if (computeFails) throw new Error("boom");
    },
    recordFailure: async () => {},
    markDone: async () => {},
    markFailed: async () => {},
    notifyDdxStatus: async (visitUuid, status) => { notified.push([visitUuid, status]); },
    maxAttempts: 3,
  });
  return notified;
};

test("processQueue notifies done after a visit is computed", async () => {
  const notified = await run([{ id: 1, visit_uuid: "v1", attempts: 0 }]);
  assert.deepEqual(notified, [["v1", "done"]]);
});

test("processQueue notifies failed only when the last attempt fails", async () => {
  const notified = await run(
    [
      { id: 1, visit_uuid: "retrying", attempts: 1 },
      { id: 2, visit_uuid: "exhausted", attempts: 2 },
    ],
    { computeFails: true }
  );
  assert.deepEqual(notified, [["exhausted", "failed"]]);
});

test("notifyDdxStatus is a no-op when the portal URL or token is not configured", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => ({ ok: true }));
  process.env.AI_DDX_NOTIFY_URL = "http://portal/api/ai-ddx/notify";
  delete process.env.AI_DDX_NOTIFY_TOKEN;
  t.after(() => {
    delete process.env.AI_DDX_NOTIFY_URL;
  });

  assert.deepEqual(await notifyDdxStatus("v1", "done"), { skipped: true });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("notifyDdxStatus posts the status with the shared token and swallows failures", async (t) => {
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push({ url, options });
    throw new Error("connection refused");
  });
  t.mock.method(console, "warn", () => {});
  process.env.AI_DDX_NOTIFY_URL = "http://portal/api/ai-ddx/notify";
  process.env.AI_DDX_NOTIFY_TOKEN = "secret";
  t.after(() => {
    delete process.env.AI_DDX_NOTIFY_URL;
    delete process.env.AI_DDX_NOTIFY_TOKEN;
  });

  assert.deepEqual(await notifyDdxStatus("v1", "failed"), { notified: false });
  assert.equal(calls[0].url, "http://portal/api/ai-ddx/notify");
  assert.equal(calls[0].options.headers["X-AI-DDX-Notify-Token"], "secret");
  assert.deepEqual(JSON.parse(calls[0].options.body), { visitUuid: "v1", status: "failed" });
});
