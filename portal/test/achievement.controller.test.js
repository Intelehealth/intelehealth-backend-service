"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { stubModule, forget, fakeResponse } = require("./helpers/stub");
const { createAchievementController } = require("../controllers/achievement.controller");
const { HttpError } = require("../services/achievement.service");
const { MESSAGE } = require("../constants/messages");

const NOW = new Date("2026-10-30T10:00:00Z");
const SETTINGS = { tzOffsetMinutes: 330, heartbeatMaxSeconds: 3600, maxRangeDays: 366, heartbeatToleranceSeconds: 0 };
const authed = (extra = {}) => ({ user: { data: { userId: "user-1" } }, query: {}, body: {}, ...extra });

const setup = (service = {}) => {
  const logs = [];
  const calls = { summary: [], heartbeat: [] };
  const fullService = {
    getSummary: async (input) => {
      calls.summary.push(input);
      return { ok: "summary" };
    },
    recordHeartbeat: async (input) => {
      calls.heartbeat.push(input);
      return { activityDate: "2026-10-30", todaySeconds: 60 };
    },
    ...service,
  };
  const controller = createAchievementController({
    getService: () => fullService,
    log: (...args) => logs.push(args),
    now: () => NOW,
    getSettings: () => SETTINGS,
  });
  return { controller, logs, calls };
};

test("getSummary: answers 200 with the service data (today by default)", async () => {
  const { controller, calls } = setup();
  const res = fakeResponse();
  await controller.getSummary(authed(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: MESSAGE.ACHIEVEMENT.SUMMARY_FETCHED_SUCCESSFULLY,
    data: { ok: "summary" },
  });
  assert.deepEqual(calls.summary, [
    { userUuid: "user-1", range: { period: "today", from: "2026-10-30", to: "2026-10-30" } },
  ]);
});

test("getSummary: passes a requested range to the service", async () => {
  const { controller, calls } = setup();
  const res = fakeResponse();
  await controller.getSummary(authed({ query: { from: "2026-10-01", to: "2026-10-30" } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.summary[0].range.from, "2026-10-01");
});

test("getSummary: 401 when the token has no user", async () => {
  const { controller, calls } = setup();
  for (const req of [{}, { user: {} }, { user: { data: {} } }, undefined]) {
    const res = fakeResponse();
    await controller.getSummary(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, MESSAGE.ACHIEVEMENT.INVALID_TOKEN);
    assert.equal(res.body.success, false);
  }
  assert.equal(calls.summary.length, 0);
});

test("getSummary: 400 with every failed rule, without calling the service", async () => {
  const { controller, calls } = setup();
  const res = fakeResponse();
  await controller.getSummary(authed({ query: { from: "bad", period: "weekly" } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, MESSAGE.ACHIEVEMENT.VALIDATION_FAILED);
  assert.ok(res.body.errors.length >= 2);
  assert.equal(calls.summary.length, 0);
});

test("getSummary: a range longer than the configured maximum is a 400", async () => {
  const logs = [];
  const controller = createAchievementController({
    getService: () => ({}),
    log: (...args) => logs.push(args),
    now: () => NOW,
    getSettings: () => ({ ...SETTINGS, maxRangeDays: 10 }),
  });
  const res = fakeResponse();
  await controller.getSummary(authed({ query: { from: "2026-10-01", to: "2026-10-30" } }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.errors[0].message, /longer than 10 days/);
});

test("getSummary: an HttpError keeps its status; a 403 is logged with the user", async () => {
  const { controller, logs } = setup({
    getSummary: async () => {
      throw new HttpError(403, MESSAGE.ACHIEVEMENT.PROVIDER_NOT_LINKED);
    },
  });
  const res = fakeResponse();
  await controller.getSummary(authed(), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, MESSAGE.ACHIEVEMENT.PROVIDER_NOT_LINKED);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], "info");
  assert.match(logs[0][1], /OpenMRS user user-1/);
});

test("getSummary: an HttpError that is not a 403 is not logged", async () => {
  const { controller, logs } = setup({
    getSummary: async () => {
      throw new HttpError(404, "missing");
    },
  });
  const res = fakeResponse();
  await controller.getSummary(authed(), res);
  assert.equal(res.statusCode, 404);
  assert.equal(logs.length, 0);
});

test("getSummary: any other error is a 500 whose detail only goes to the log", async () => {
  const { controller, logs } = setup({
    getSummary: async () => {
      throw new Error("connection lost");
    },
  });
  const res = fakeResponse();
  await controller.getSummary(authed(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, MESSAGE.ACHIEVEMENT.INTERNAL_ERROR);
  assert.ok(!JSON.stringify(res.body).includes("connection lost"));
  assert.equal(logs[0][0], "error");
  assert.match(logs[0][1], /connection lost/);
});

test("a thrown null is still a 500", async () => {
  const { controller, logs } = setup({
    recordHeartbeat: async () => {
      throw null; // eslint-disable-line no-throw-literal
    },
  });
  const res = fakeResponse();
  await controller.recordHeartbeat(authed({ body: { activeSeconds: 5 } }), res);
  assert.equal(res.statusCode, 500);
  assert.match(logs[0][1], /POST activity heartbeat failed: null/);
});

test("recordHeartbeat: answers 200 and passes the validated beat to the service", async () => {
  const { controller, calls } = setup();
  const res = fakeResponse();
  await controller.recordHeartbeat(
    authed({ body: { activeSeconds: 60, endedSecondsAgo: 5, requestId: "req-1" } }),
    res
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: MESSAGE.ACHIEVEMENT.HEARTBEAT_RECORDED_SUCCESSFULLY,
    data: { activityDate: "2026-10-30", todaySeconds: 60 },
  });
  assert.deepEqual(calls.heartbeat, [
    { userUuid: "user-1", activeSeconds: 60, endedSecondsAgo: 5, requestId: "req-1" },
  ]);
});

test("recordHeartbeat: 401 when the token has no user", async () => {
  const { controller, calls } = setup();
  const res = fakeResponse();
  await controller.recordHeartbeat({ body: { activeSeconds: 5 } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls.heartbeat.length, 0);
});

test("recordHeartbeat: 400 for an invalid body, using the configured maximum", async () => {
  const { controller, calls } = setup();
  const res = fakeResponse();
  await controller.recordHeartbeat(authed({ body: { activeSeconds: 3601 } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.errors[0].field, "activeSeconds");
  assert.equal(calls.heartbeat.length, 0);
});

test("recordHeartbeat: a service HttpError keeps its status", async () => {
  const { controller } = setup({
    recordHeartbeat: async () => {
      throw new HttpError(403, MESSAGE.ACHIEVEMENT.PROVIDER_NOT_LINKED);
    },
  });
  const res = fakeResponse();
  await controller.recordHeartbeat(authed({ body: { activeSeconds: 5 } }), res);
  assert.equal(res.statusCode, 403);
});

test("the controller uses the real clock and settings when none are passed", async () => {
  const controller = createAchievementController({
    getService: () => ({ getSummary: async ({ range }) => range }),
    log: () => {},
  });
  const res = fakeResponse();
  await controller.getSummary(authed(), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.data.from, /^\d{4}-\d{2}-\d{2}$/);
});

test("the exported handlers build the controller once, from the real service and logger", async () => {
  const logged = [];
  let serviceBuilt = 0;
  const service = {
    getSummary: async () => ({ via: "stub" }),
    recordHeartbeat: async () => ({ activityDate: "2026-10-30", todaySeconds: 1 }),
  };
  const restoreService = stubModule("services/achievement.service", {
    HttpError,
    getAchievementService: () => {
      serviceBuilt += 1;
      return service;
    },
  });
  const restoreLogger = stubModule("logger/index", { logStream: (...args) => logged.push(args) });
  forget("controllers/achievement.controller");
  try {
    const fresh = require("../controllers/achievement.controller");
    const summaryRes = fakeResponse();
    await fresh.getSummary(authed(), summaryRes);
    assert.equal(summaryRes.statusCode, 200);
    assert.deepEqual(summaryRes.body.data, { via: "stub" });

    const beatRes = fakeResponse();
    await fresh.recordHeartbeat(authed({ body: { activeSeconds: 5 } }), beatRes);
    assert.equal(beatRes.statusCode, 200);
    assert.equal(serviceBuilt, 2); // getService is asked on every call; the controller itself is built once

    const failRes = fakeResponse();
    await fresh.recordHeartbeat(authed({ body: {} }), failRes);
    assert.equal(failRes.statusCode, 400);
    assert.deepEqual(logged, []);
  } finally {
    restoreService();
    restoreLogger();
    forget("controllers/achievement.controller");
  }
});
