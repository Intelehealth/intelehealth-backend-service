"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { QueryTypes } = require("sequelize");
const { stubModule, forget } = require("./helpers/stub");
const {
  HttpError,
  createAchievementService,
  getAchievementService,
  recordedByProvider,
} = require("../services/achievement.service");
const {
  INITIAL_ENCOUNTER_TYPE_UUID,
  VISIT_COMPLETE_ENCOUNTER_TYPE_UUID,
  PATIENT_EXIT_SURVEY_ENCOUNTER_TYPE_UUID,
  PROVIDER_ATTRIBUTE_TYPE_UUID,
  CREATED_DATE_ATTRIBUTE_TYPE_UUID,
  PROVISIONAL_FIELDS,
} = require("../constants/achievement.constant");
const { MESSAGE } = require("../constants/messages");

const NOW = new Date("2026-10-30T10:00:00Z");
const SETTINGS = { tzOffsetMinutes: 330, heartbeatMaxSeconds: 3600, maxRangeDays: 366, heartbeatToleranceSeconds: 0 };
const TODAY_RANGE = { from: "2026-10-30", to: "2026-10-30" };
const ALL_TIME = { from: null, to: null };

// Which statement a raw query is, by a phrase that appears in only that one.
const kindOf = (sql) => {
  if (sql.includes("FROM users u")) return "provider";
  if (sql.includes("SELECT cu.user_id")) return "creators";
  if (sql.includes("created_value")) return "unread";
  if (sql.includes("COUNT(DISTINCT t.person_id)")) return "beneficiaries";
  if (sql.includes("COUNT(DISTINCT e.visit_id)")) return "doctorVisits";
  if (sql.includes("COUNT(DISTINCT v.visit_id)")) return "pending";
  throw new Error(`unexpected statement: ${sql}`);
};

/**
 * Fakes for the databases. `answers` maps a statement kind to its rows, or to a function of the options.
 */
const build = ({ answers = {}, activity = {}, heartbeat, now = NOW, ...overrides } = {}) => {
  const queries = [];
  const defaults = {
    provider: [{ provider_uuid: "prov-1" }],
    creators: [],
    beneficiaries: [{ total: 0, in_range: 0, unread: 0 }],
    unread: [],
    doctorVisits: [{ total: 0 }],
    pending: [{ total: 0 }],
  };
  const openmrs = {
    query: async (sql, options) => {
      const kind = kindOf(sql);
      queries.push({ kind, sql, options });
      const answer = kind in answers ? answers[kind] : defaults[kind];
      return typeof answer === "function" ? answer(options, queries) : answer;
    },
  };

  const writes = [];
  const sequelize = {
    query: async (sql, options) => {
      writes.push({ sql, options });
      if (heartbeat) return heartbeat(sql, options, writes);
      return [0, 1];
    },
  };

  const reads = { sum: [], count: [], findOne: [] };
  const userActivity = {
    sum: async (column, options) => {
      reads.sum.push({ column, options });
      return "sum" in activity ? activity.sum : null;
    },
    count: async (options) => {
      reads.count.push(options);
      return "count" in activity ? activity.count : 0;
    },
    findOne: async (options) => {
      reads.findOne.push(options);
      return "row" in activity ? activity.row : null;
    },
  };

  const service = createAchievementService({
    openmrs,
    userActivity,
    sequelize,
    now: () => (typeof now === "function" ? now() : now),
    getSettings: () => SETTINGS,
    ...overrides,
  });
  return { service, queries, writes, reads };
};

const ofKind = (queries, kind) => queries.filter((q) => q.kind === kind);

// ---------------------------------------------------------------------------------------------
// the SQL identifier whitelist
// ---------------------------------------------------------------------------------------------

test("recordedByProvider: only a key from the fixed list picks the visit column", () => {
  assert.match(recordedByProvider("encounterVisit"), /mine\.visit_id = e\.visit_id/);
  assert.match(recordedByProvider("visit"), /mine\.visit_id = v\.visit_id/);
});

test("recordedByProvider: anything else is refused, so no text can reach the statement", () => {
  for (const bad of ["e.visit_id", "1; DROP TABLE visit", "", undefined, null, "__proto__", "constructor", "toString"]) {
    assert.throws(() => recordedByProvider(bad), /Unknown visit column key/, `key ${String(bad)}`);
  }
});

test("the statements that use the whitelist name the right visit column", async () => {
  const { service, queries } = build({ answers: { pending: [{ total: 2 }] } });
  await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.match(ofKind(queries, "doctorVisits")[0].sql, /mine\.visit_id = e\.visit_id/);
  assert.match(ofKind(queries, "pending")[0].sql, /mine\.visit_id = v\.visit_id/);
});

// ---------------------------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------------------------

test("HttpError carries a status code and a message", () => {
  const error = new HttpError(403, "nope");
  assert.ok(error instanceof Error);
  assert.equal(error.name, "HttpError");
  assert.equal(error.code, 403);
  assert.equal(error.message, "nope");
});

// ---------------------------------------------------------------------------------------------
// provider lookup
// ---------------------------------------------------------------------------------------------

test("resolveProviderUuid: finds the provider of the user and keeps it for a while", async () => {
  let time = NOW.getTime();
  const { service, queries } = build({ now: () => new Date(time) });
  assert.equal(await service.resolveProviderUuid("u1"), "prov-1");
  assert.equal(await service.resolveProviderUuid("u1"), "prov-1");
  assert.equal(ofKind(queries, "provider").length, 1);
  assert.deepEqual(queries[0].options, { replacements: { userUuid: "u1" }, type: QueryTypes.SELECT });

  time += 10 * 60 * 1000 + 1; // past the cache lifetime
  await service.resolveProviderUuid("u1");
  assert.equal(ofKind(queries, "provider").length, 2);
});

test("resolveProviderUuid: 403 when no provider is linked, and that is not cached", async () => {
  let rows = [];
  const { service, queries } = build({ answers: { provider: () => rows } });
  await assert.rejects(
    () => service.resolveProviderUuid("u1"),
    (error) => error instanceof HttpError && error.code === 403 && error.message === MESSAGE.ACHIEVEMENT.PROVIDER_NOT_LINKED
  );
  rows = null; // a driver that returns nothing at all
  await assert.rejects(() => service.resolveProviderUuid("u1"), (error) => error.code === 403);
  rows = [{ provider_uuid: "prov-late" }]; // linked later
  assert.equal(await service.resolveProviderUuid("u1"), "prov-late");
  assert.equal(ofKind(queries, "provider").length, 3);
});

test("resolveProviderUuid: a TTL of 0 turns the cache off", async () => {
  const { service, queries } = build({ providerCacheTtlMs: 0 });
  await service.resolveProviderUuid("u1");
  await service.resolveProviderUuid("u1");
  assert.equal(ofKind(queries, "provider").length, 2);
});

test("resolveProviderUuid: the cache is emptied when it reaches its limit", async () => {
  const { service, queries } = build();
  for (let i = 0; i < 5000; i += 1) await service.resolveProviderUuid(`user-${i}`);
  assert.equal(ofKind(queries, "provider").length, 5000);
  await service.resolveProviderUuid("user-0"); // still cached: the limit has not been passed yet
  assert.equal(ofKind(queries, "provider").length, 5000);
  await service.resolveProviderUuid("user-new"); // the 5001st entry empties the cache first
  assert.equal(ofKind(queries, "provider").length, 5001);
  await service.resolveProviderUuid("user-1"); // gone, so it is looked up again
  assert.equal(ofKind(queries, "provider").length, 5002);
});

// ---------------------------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------------------------

test("getSummary: for a range, the range and the all-time numbers are asked separately", async () => {
  const { service, queries, reads } = build({
    answers: {
      beneficiaries: [{ total: "12", in_range: "3", unread: "0" }],
      doctorVisits: (options) => [{ total: options.replacements.rangeStart ? 4 : 40 }],
      pending: [{ total: 5 }],
    },
    activity: { sum: "7200", count: 2, row: { active_seconds: 30 } },
  });
  const summary = await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });

  assert.deepEqual(summary, {
    from: "2026-10-30",
    to: "2026-10-30",
    doctorVisitsToday: 4,
    doctorVisitsCompletedTotal: 40,
    visitsPendingFromDoctor: 5,
    beneficiariesRegisteredToday: 3,
    beneficiariesRegisteredTotal: 12,
    dailyTimeSpentSeconds: 7200,
    averageDailyTimeSpentSeconds: 3600,
    activeDaysCount: 2,
    status: "Active",
    meta: { provisional: PROVISIONAL_FIELDS },
  });
  assert.notEqual(summary.meta.provisional, PROVISIONAL_FIELDS); // a copy, so a caller cannot change the constant

  const [inRange, allTime] = ofKind(queries, "doctorVisits");
  assert.equal(inRange.options.replacements.rangeStart, "2026-10-30 00:00:00");
  assert.equal(inRange.options.replacements.rangeEnd, "2026-10-31 00:00:00");
  assert.match(inRange.sql, /e\.encounter_datetime >= :rangeStart/);
  assert.equal(allTime.options.replacements.rangeStart, undefined);
  assert.doesNotMatch(allTime.sql, /encounter_datetime/);
  assert.equal(allTime.options.replacements.initialType, INITIAL_ENCOUNTER_TYPE_UUID);
  assert.equal(allTime.options.replacements.visitCompleteType, VISIT_COMPLETE_ENCOUNTER_TYPE_UUID);

  assert.equal(reads.sum.length, 2); // range and all time
  assert.deepEqual(reads.sum[0].options.where.provider_uuid, "prov-1");
  assert.ok(reads.sum[0].options.where.activity_date);
  assert.equal(reads.sum[1].options.where.activity_date, undefined);
});

test("getSummary: an all-time request does not count the same thing twice", async () => {
  const { service, queries, reads } = build({
    answers: { doctorVisits: [{ total: 9 }], beneficiaries: [{ total: 8, in_range: 0, unread: 3 }] },
    activity: { sum: 600, count: 3 },
  });
  const summary = await service.getSummary({ userUuid: "u1", range: ALL_TIME });
  assert.equal(ofKind(queries, "doctorVisits").length, 1);
  assert.equal(reads.sum.length, 1);
  assert.equal(summary.from, null);
  assert.equal(summary.doctorVisitsToday, 9);
  assert.equal(summary.doctorVisitsCompletedTotal, 9);
  assert.equal(summary.beneficiariesRegisteredToday, 8);
  assert.equal(summary.beneficiariesRegisteredTotal, 8);
  assert.equal(summary.dailyTimeSpentSeconds, 600);
  assert.equal(summary.averageDailyTimeSpentSeconds, 200);
  assert.equal(ofKind(queries, "unread").length, 0); // nothing to read for an all-time count
});

test("getSummary: with no activity the status is Inactive and the numbers are 0", async () => {
  const { service } = build({ activity: { row: { active_seconds: 0 } } });
  const summary = await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.equal(summary.status, "Inactive");
  assert.equal(summary.dailyTimeSpentSeconds, 0);
  assert.equal(summary.averageDailyTimeSpentSeconds, 0);
  assert.equal(summary.activeDaysCount, 0);
});

test("getSummary: no row for today means Inactive; the day is looked up in the configured zone", async () => {
  const { service, reads } = build({ now: new Date("2026-10-30T20:00:00Z") }); // already 31 October in IST
  const summary = await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.equal(summary.status, "Inactive");
  assert.equal(reads.findOne[0].where.activity_date, "2026-10-31");
});

test("getSummary: non-numeric database answers count as 0", async () => {
  const { service } = build({
    answers: { doctorVisits: null, pending: [], beneficiaries: null },
    activity: { sum: undefined, count: "abc" },
  });
  const summary = await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.equal(summary.doctorVisitsToday, 0);
  assert.equal(summary.doctorVisitsCompletedTotal, 0);
  assert.equal(summary.visitsPendingFromDoctor, 0);
  assert.equal(summary.beneficiariesRegisteredTotal, 0);
  assert.equal(summary.dailyTimeSpentSeconds, 0);
  assert.equal(summary.activeDaysCount, 0);
});

test("getSummary: 403 when the user has no provider, before anything is counted", async () => {
  const { service, queries } = build({ answers: { provider: [] } });
  await assert.rejects(() => service.getSummary({ userUuid: "u1", range: TODAY_RANGE }), { code: 403 });
  assert.equal(queries.length, 1);
});

// ---------------------------------------------------------------------------------------------
// beneficiaries
// ---------------------------------------------------------------------------------------------

test("beneficiaries: the creators found are bound as a list, and an empty list becomes [-1]", async () => {
  const withCreators = build({ answers: { creators: [{ user_id: 7 }, { user_id: 9 }] } });
  await withCreators.service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  const bound = ofKind(withCreators.queries, "beneficiaries")[0].options.replacements;
  assert.deepEqual(bound.creatorUserIds, [7, 9]);
  assert.equal(bound.providerUuid, "prov-1");
  assert.equal(bound.providerAttributeType, PROVIDER_ATTRIBUTE_TYPE_UUID);
  assert.equal(bound.createdDateAttributeType, CREATED_DATE_ATTRIBUTE_TYPE_UUID);
  assert.equal(bound.rangeFrom, "2026-10-30");
  assert.equal(bound.rangeTo, "2026-10-30");

  for (const empty of [[], null]) {
    const none = build({ answers: { creators: empty } });
    await none.service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
    assert.deepEqual(ofKind(none.queries, "beneficiaries")[0].options.replacements.creatorUserIds, [-1]);
  }
});

test("beneficiaries: an all-time request counts with open date limits", async () => {
  const { service, queries } = build();
  await service.getSummary({ userUuid: "u1", range: ALL_TIME });
  const bound = ofKind(queries, "beneficiaries")[0].options.replacements;
  assert.equal(bound.rangeFrom, "1000-01-01");
  assert.equal(bound.rangeTo, "9999-12-31");
});

test("beneficiaries: values the SQL cannot read are read in JavaScript and counted once each", async () => {
  const { service, queries } = build({
    answers: {
      beneficiaries: [{ total: 10, in_range: 2, unread: 5 }],
      unread: [
        { person_id: 1, created_value: "27 Oct 2026" }, // in range
        { person_id: 1, created_value: "27 Oct 2026" }, // the same patient again: still one
        { person_id: 2, created_value: "October 28, 2026" }, // in range
        { person_id: 3, created_value: "1 Jan 2020" }, // before the range
        { person_id: 4, created_value: "1 Dec 2030" }, // after the range
        { person_id: 5, created_value: "garbage" }, // unreadable even here
      ],
    },
  });
  const summary = await service.getSummary({ userUuid: "u1", range: { from: "2026-10-01", to: "2026-10-31" } });
  assert.equal(summary.beneficiariesRegisteredToday, 4); // 2 counted in SQL + patients 1 and 2
  assert.equal(summary.beneficiariesRegisteredTotal, 10);
  assert.equal(ofKind(queries, "unread").length, 1);
});

test("beneficiaries: nothing is fetched to be read when the SQL read every value", async () => {
  const { service, queries } = build({ answers: { beneficiaries: [{ total: 4, in_range: 4, unread: 0 }] } });
  const summary = await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.equal(summary.beneficiariesRegisteredToday, 4);
  assert.equal(ofKind(queries, "unread").length, 0);
});

test("beneficiaries: a missing list of unread rows adds nothing", async () => {
  const { service } = build({
    answers: { beneficiaries: [{ total: 4, in_range: 1, unread: 2 }], unread: null },
  });
  const summary = await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.equal(summary.beneficiariesRegisteredToday, 1);
});

// ---------------------------------------------------------------------------------------------
// pending visits
// ---------------------------------------------------------------------------------------------

test("pending visits: counted once a minute per provider", async () => {
  let time = NOW.getTime();
  const { service, queries } = build({ now: () => new Date(time), answers: { pending: [{ total: 6 }] } });
  assert.equal((await service.getSummary({ userUuid: "u1", range: TODAY_RANGE })).visitsPendingFromDoctor, 6);
  assert.equal((await service.getSummary({ userUuid: "u1", range: TODAY_RANGE })).visitsPendingFromDoctor, 6);
  assert.equal(ofKind(queries, "pending").length, 1);
  assert.deepEqual(ofKind(queries, "pending")[0].options.replacements.finishedTypes, [
    VISIT_COMPLETE_ENCOUNTER_TYPE_UUID,
    PATIENT_EXIT_SURVEY_ENCOUNTER_TYPE_UUID,
  ]);

  time += 60 * 1000 + 1;
  await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.equal(ofKind(queries, "pending").length, 2);
});

test("pending visits: a TTL of 0 counts every time", async () => {
  const { service, queries } = build({ pendingVisitsTtlMs: 0 });
  await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  await service.getSummary({ userUuid: "u1", range: TODAY_RANGE });
  assert.equal(ofKind(queries, "pending").length, 2);
});

test("pending visits: the cache is emptied when it reaches its limit", async () => {
  // one provider per user, because the count is kept per provider
  const { service, queries } = build({
    answers: { provider: (options) => [{ provider_uuid: `prov-${options.replacements.userUuid}` }] },
  });
  for (let i = 0; i < 5000; i += 1) {
    await service.getSummary({ userUuid: `user-${i}`, range: ALL_TIME });
  }
  assert.equal(ofKind(queries, "pending").length, 5000);
  await service.getSummary({ userUuid: "user-5000", range: ALL_TIME });
  await service.getSummary({ userUuid: "user-0", range: ALL_TIME }); // emptied, so counted again
  assert.equal(ofKind(queries, "pending").length, 5002);
});

// ---------------------------------------------------------------------------------------------
// heartbeat
// ---------------------------------------------------------------------------------------------

test("recordHeartbeat: one upsert statement with every value bound, then the day's total is read", async () => {
  const { service, writes, reads } = build({ activity: { row: { active_seconds: 120 } } });
  const result = await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 60, requestId: "req-1" });

  assert.deepEqual(result, { activityDate: "2026-10-30", todaySeconds: 120 });
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INSERT INTO user_activity/);
  assert.match(writes[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(writes[0].options, {
    replacements: {
      providerUuid: "prov-1",
      activityDate: "2026-10-30",
      seconds: 60,
      dailyMax: 86400,
      tolerance: 0,
      endedAt: "2026-10-30 10:00:00",
      requestId: "req-1",
    },
    type: QueryTypes.INSERT,
  });
  assert.deepEqual(reads.findOne[0], {
    attributes: ["active_seconds"],
    where: { provider_uuid: "prov-1", activity_date: "2026-10-30" },
  });
});

test("recordHeartbeat: the statement is one atomic upsert, with no separate lock or read-modify-write", async () => {
  const { service, writes } = build();
  await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 });
  assert.equal(writes.length, 1);
  assert.doesNotMatch(writes[0].sql, /FOR UPDATE|LOCK TABLES/i);
  // the covered_until it computed from is the one in the row at the moment the statement runs
  assert.match(writes[0].sql, /TIMESTAMPDIFF\(SECOND, covered_until, :endedAt\)/);
  assert.match(writes[0].sql, /GREATEST\(covered_until, :endedAt\)/);
});

test("recordHeartbeat: the tolerance comes from the settings", async () => {
  const { service, writes } = build({ getSettings: () => ({ ...SETTINGS, heartbeatToleranceSeconds: 3 }) });
  await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 });
  assert.equal(writes[0].options.replacements.tolerance, 3);
});

test("recordHeartbeat: the period end and the IST day follow endedSecondsAgo", async () => {
  // 20:00 UTC on 30 October is 01:30 on 31 October in IST; 2 hours earlier it was still the 30th.
  const { service, writes } = build({ now: new Date("2026-10-30T20:00:00Z") });
  const recent = await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 });
  assert.equal(recent.activityDate, "2026-10-31");
  const earlier = await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10, endedSecondsAgo: 2 * 3600 });
  assert.equal(earlier.activityDate, "2026-10-30");
  assert.equal(writes[1].options.replacements.endedAt, "2026-10-30 18:00:00");
  assert.equal(writes[1].options.replacements.requestId, null);
});

test("recordHeartbeat: without a stored row the answer falls back to the claimed seconds, capped at a day", async () => {
  const { service } = build();
  assert.equal((await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 45 })).todaySeconds, 45);
  assert.equal((await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 200000 })).todaySeconds, 86400);
});

test("recordHeartbeat: a deadlock victim is run again and succeeds", async () => {
  let attempts = 0;
  const { service, writes } = build({
    heartbeat: () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("Deadlock found");
        error.parent = { code: "ER_LOCK_DEADLOCK" };
        throw error;
      }
      return [0, 1];
    },
  });
  await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 });
  assert.equal(writes.length, 3);
});

test("recordHeartbeat: a deadlock is recognised on the original error too", async () => {
  let attempts = 0;
  const { service } = build({
    heartbeat: () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("Deadlock found");
        error.original = { code: "ER_LOCK_DEADLOCK" };
        throw error;
      }
      return [0, 1];
    },
  });
  await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 });
  assert.equal(attempts, 2);
});

test("recordHeartbeat: gives up after 3 attempts at a deadlock", async () => {
  let attempts = 0;
  const { service } = build({
    heartbeat: () => {
      attempts += 1;
      const error = new Error("Deadlock found");
      error.parent = { code: "ER_LOCK_DEADLOCK" };
      throw error;
    },
  });
  await assert.rejects(() => service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 }), /Deadlock found/);
  assert.equal(attempts, 3);
});

test("recordHeartbeat: any other database error is thrown at once", async () => {
  const failures = [
    new Error("connection lost"),
    Object.assign(new Error("other parent"), { parent: { code: "ER_BAD_FIELD_ERROR" } }),
    Object.assign(new Error("other original"), { original: { code: "ER_BAD_FIELD_ERROR" } }),
  ];
  for (const failure of failures) {
    let attempts = 0;
    const { service } = build({
      heartbeat: () => {
        attempts += 1;
        throw failure;
      },
    });
    await assert.rejects(() => service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 }), { message: failure.message });
    assert.equal(attempts, 1);
  }
});

test("recordHeartbeat: a falsy error is not mistaken for a deadlock", async () => {
  const { service } = build({
    heartbeat: () => {
      throw null; // eslint-disable-line no-throw-literal
    },
  });
  await assert.rejects(() => service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 }), (error) => error === null);
});

test("recordHeartbeat: 403 when the user has no provider; nothing is written", async () => {
  const { service, writes } = build({ answers: { provider: [] } });
  await assert.rejects(() => service.recordHeartbeat({ userUuid: "u1", activeSeconds: 10 }), { code: 403 });
  assert.equal(writes.length, 0);
});

// ---------------------------------------------------------------------------------------------
// defaults and wiring
// ---------------------------------------------------------------------------------------------

test("the service works with only its databases: real clock and settings by default", async () => {
  const writes = [];
  const service = createAchievementService({
    openmrs: { query: async () => [{ provider_uuid: "prov-1" }] },
    userActivity: { findOne: async () => ({ active_seconds: 15 }) },
    sequelize: { query: async (sql, options) => writes.push(options) },
  });
  const result = await service.recordHeartbeat({ userUuid: "u1", activeSeconds: 15 });
  assert.equal(result.todaySeconds, 15);
  assert.match(result.activityDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(writes[0].replacements.tolerance, 0);
});

test("getAchievementService wires the real databases once, on first use", () => {
  const openmrs = { query: async () => [] };
  const portal = { user_activity: {}, sequelize: {} };
  const restoreOpenmrs = stubModule("openmrs_models", { sequelize: openmrs });
  const restoreModels = stubModule("models", portal);
  forget("services/achievement.service");
  try {
    const fresh = require("../services/achievement.service");
    const first = fresh.getAchievementService();
    const second = fresh.getAchievementService();
    assert.equal(first, second);
    assert.deepEqual(Object.keys(first).sort(), ["getSummary", "recordHeartbeat", "resolveProviderUuid"]);
  } finally {
    restoreOpenmrs();
    restoreModels();
    forget("services/achievement.service");
  }
  assert.equal(typeof getAchievementService, "function");
});
