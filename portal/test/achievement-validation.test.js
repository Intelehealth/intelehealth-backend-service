"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getConfig,
  isRealDate,
  daysInclusive,
  addDays,
  todayInOffset,
  validateSummaryQuery,
  validateHeartbeatBody,
  toIsoDate,
} = require("../services/achievement-validation");
const { DEFAULTS, MAX_HEARTBEAT_TOLERANCE_SECONDS } = require("../constants/achievement.constant");

const OPTIONS = { maxRangeDays: 366, today: "2026-10-30" };
const fields = (result) => result.errors.map((e) => e.field);

test("getConfig: uses the defaults when nothing is set", () => {
  assert.deepEqual(getConfig({}), {
    tzOffsetMinutes: DEFAULTS.TZ_OFFSET_MINUTES,
    heartbeatMaxSeconds: DEFAULTS.HEARTBEAT_MAX_SECONDS,
    maxRangeDays: DEFAULTS.MAX_RANGE_DAYS,
    heartbeatToleranceSeconds: DEFAULTS.HEARTBEAT_TOLERANCE_SECONDS,
  });
});

test("getConfig: reads process.env when no environment is passed", () => {
  const saved = process.env.ACHIEVEMENTS_MAX_RANGE_DAYS;
  process.env.ACHIEVEMENTS_MAX_RANGE_DAYS = "31";
  try {
    assert.equal(getConfig().maxRangeDays, 31);
  } finally {
    if (saved === undefined) delete process.env.ACHIEVEMENTS_MAX_RANGE_DAYS;
    else process.env.ACHIEVEMENTS_MAX_RANGE_DAYS = saved;
  }
});

test("getConfig: the maximum range is read from ACHIEVEMENTS_MAX_RANGE_DAYS", () => {
  assert.equal(getConfig({ ACHIEVEMENTS_MAX_RANGE_DAYS: "90" }).maxRangeDays, 90);
});

test("getConfig: a bad or non-positive value falls back to the default", () => {
  for (const bad of ["abc", "0", "-5", ""]) {
    const config = getConfig({ ACHIEVEMENTS_MAX_RANGE_DAYS: bad, HEARTBEAT_MAX_SECONDS: bad });
    assert.equal(config.maxRangeDays, DEFAULTS.MAX_RANGE_DAYS, `range for "${bad}"`);
    assert.equal(config.heartbeatMaxSeconds, DEFAULTS.HEARTBEAT_MAX_SECONDS, `seconds for "${bad}"`);
  }
});

test("getConfig: reads the heartbeat limit and the time zone offset", () => {
  const config = getConfig({ HEARTBEAT_MAX_SECONDS: "600", ACHIEVEMENTS_TZ_OFFSET_MINUTES: "-300" });
  assert.equal(config.heartbeatMaxSeconds, 600);
  assert.equal(config.tzOffsetMinutes, -300);
  assert.equal(getConfig({ ACHIEVEMENTS_TZ_OFFSET_MINUTES: "0" }).tzOffsetMinutes, 0);
  assert.equal(getConfig({ ACHIEVEMENTS_TZ_OFFSET_MINUTES: "x" }).tzOffsetMinutes, DEFAULTS.TZ_OFFSET_MINUTES);
});

test("getConfig: the heartbeat tolerance defaults to 0 and accepts 0 up to the maximum", () => {
  assert.equal(getConfig({}).heartbeatToleranceSeconds, 0);
  assert.equal(getConfig({ ACHIEVEMENTS_HEARTBEAT_TOLERANCE_SECONDS: "0" }).heartbeatToleranceSeconds, 0);
  assert.equal(getConfig({ ACHIEVEMENTS_HEARTBEAT_TOLERANCE_SECONDS: "3" }).heartbeatToleranceSeconds, 3);
  assert.equal(
    getConfig({ ACHIEVEMENTS_HEARTBEAT_TOLERANCE_SECONDS: String(MAX_HEARTBEAT_TOLERANCE_SECONDS) })
      .heartbeatToleranceSeconds,
    MAX_HEARTBEAT_TOLERANCE_SECONDS
  );
});

test("getConfig: a negative, too large or non-numeric tolerance falls back to the default", () => {
  for (const bad of ["-1", String(MAX_HEARTBEAT_TOLERANCE_SECONDS + 1), "1000", "abc", ""]) {
    assert.equal(
      getConfig({ ACHIEVEMENTS_HEARTBEAT_TOLERANCE_SECONDS: bad }).heartbeatToleranceSeconds,
      DEFAULTS.HEARTBEAT_TOLERANCE_SECONDS,
      `tolerance for "${bad}"`
    );
  }
});

test("isRealDate: accepts real dates only", () => {
  assert.equal(isRealDate("2026-10-30"), true);
  assert.equal(isRealDate("2028-02-29"), true);
  assert.equal(isRealDate("2026-02-30"), false);
  assert.equal(isRealDate("2026-13-01"), false);
  assert.equal(isRealDate("2026-1-1"), false);
  assert.equal(isRealDate("30-10-2026"), false);
  assert.equal(isRealDate(20261030), false);
  assert.equal(isRealDate(undefined), false);
});

test("daysInclusive and addDays count and move calendar days", () => {
  assert.equal(daysInclusive("2026-10-30", "2026-10-30"), 1);
  assert.equal(daysInclusive("2026-10-01", "2026-10-31"), 31);
  assert.equal(daysInclusive("2026-01-01", "2026-12-31"), 365);
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("todayInOffset: gives the date in the zone of the offset", () => {
  const instant = new Date("2026-10-30T20:00:00Z");
  assert.equal(todayInOffset(instant, 0), "2026-10-30");
  assert.equal(todayInOffset(instant, 330), "2026-10-31");
  assert.equal(todayInOffset(instant, -300), "2026-10-30");
});

test("validateSummaryQuery: no dates means today", () => {
  assert.deepEqual(validateSummaryQuery({}, OPTIONS), {
    errors: [],
    value: { period: "today", from: "2026-10-30", to: "2026-10-30" },
  });
  assert.deepEqual(validateSummaryQuery(undefined, OPTIONS).value.period, "today");
  assert.deepEqual(validateSummaryQuery("text", OPTIONS).value.period, "today");
  assert.deepEqual(validateSummaryQuery(null, OPTIONS).value.period, "today");
});

test("validateSummaryQuery: period=today is accepted", () => {
  assert.equal(validateSummaryQuery({ period: "today" }, OPTIONS).value.period, "today");
});

test("validateSummaryQuery: period=overall has no dates", () => {
  assert.deepEqual(validateSummaryQuery({ period: "overall" }, OPTIONS).value, {
    period: "overall",
    from: null,
    to: null,
  });
});

test("validateSummaryQuery: a from and to pair is a range", () => {
  assert.deepEqual(validateSummaryQuery({ from: "2026-10-01", to: "2026-10-30" }, OPTIONS).value, {
    period: "range",
    from: "2026-10-01",
    to: "2026-10-30",
  });
});

test("validateSummaryQuery: from and to must come together", () => {
  assert.deepEqual(fields(validateSummaryQuery({ from: "2026-10-01" }, OPTIONS)), ["to"]);
  assert.deepEqual(fields(validateSummaryQuery({ to: "2026-10-01" }, OPTIONS)), ["from"]);
});

test("validateSummaryQuery: dates must be real YYYY-MM-DD dates", () => {
  const result = validateSummaryQuery({ from: "2026-02-30", to: "tomorrow" }, OPTIONS);
  assert.deepEqual(fields(result), ["from", "to"]);
  assert.equal(result.value, null);
});

test("validateSummaryQuery: from must not be after to", () => {
  const result = validateSummaryQuery({ from: "2026-10-30", to: "2026-10-01" }, OPTIONS);
  assert.deepEqual(result.errors, [{ field: "from", message: "from must not be after to" }]);
});

test("validateSummaryQuery: the range is limited by maxRangeDays", () => {
  const edge = validateSummaryQuery({ from: "2026-01-01", to: "2026-03-31" }, { ...OPTIONS, maxRangeDays: 90 });
  assert.deepEqual(edge.errors, []);
  const over = validateSummaryQuery({ from: "2026-01-01", to: "2026-04-01" }, { ...OPTIONS, maxRangeDays: 90 });
  assert.deepEqual(over.errors, [{ field: "to", message: "Date range cannot be longer than 90 days" }]);
});

test("validateSummaryQuery: repeated parameters are rejected", () => {
  const result = validateSummaryQuery({ from: ["2026-10-01", "2026-10-02"], to: "2026-10-30", period: ["today"] }, OPTIONS);
  assert.deepEqual(fields(result), ["from", "period"]);
  assert.match(result.errors[0].message, /single value/);
  assert.equal(fields(validateSummaryQuery({ from: "2026-10-01", to: ["a"] }, OPTIONS))[0], "to");
});

test("validateSummaryQuery: period must be today or overall", () => {
  const result = validateSummaryQuery({ period: "weekly" }, OPTIONS);
  assert.deepEqual(result.errors, [{ field: "period", message: "period must be today or overall" }]);
});

test("validateSummaryQuery: overall cannot be combined with dates", () => {
  const withFrom = validateSummaryQuery({ period: "overall", from: "2026-10-01", to: "2026-10-02" }, OPTIONS);
  assert.deepEqual(fields(withFrom), ["period"]);
  const withOnlyTo = validateSummaryQuery({ period: "overall", to: "2026-10-02" }, OPTIONS);
  assert.deepEqual(fields(withOnlyTo).sort(), ["from", "period"]);
});

test("validateHeartbeatBody: rejects a body that is not an object", () => {
  for (const body of [null, undefined, [], "text", 5]) {
    const result = validateHeartbeatBody(body, { maxSeconds: 3600 });
    assert.equal(result.value, null);
    assert.deepEqual(result.errors, [{ field: "body", message: "Request body must be a JSON object" }]);
  }
});

test("validateHeartbeatBody: activeSeconds is required and a whole number in range", () => {
  const opts = { maxSeconds: 3600 };
  assert.deepEqual(validateHeartbeatBody({}, opts).errors, [
    { field: "activeSeconds", message: "activeSeconds is required" },
  ]);
  assert.equal(validateHeartbeatBody({ activeSeconds: null }, opts).errors[0].message, "activeSeconds is required");
  assert.equal(validateHeartbeatBody({ activeSeconds: "5" }, opts).errors[0].message, "activeSeconds must be a whole number");
  assert.equal(validateHeartbeatBody({ activeSeconds: 1.5 }, opts).errors[0].message, "activeSeconds must be a whole number");
  assert.equal(validateHeartbeatBody({ activeSeconds: 0 }, opts).errors[0].message, "activeSeconds must be at least 1");
  assert.equal(validateHeartbeatBody({ activeSeconds: 3601 }, opts).errors[0].message, "activeSeconds must not be more than 3600");
});

test("validateHeartbeatBody: a plain beat", () => {
  assert.deepEqual(validateHeartbeatBody({ activeSeconds: 60 }, { maxSeconds: 3600 }), {
    errors: [],
    value: { activeSeconds: 60, endedSecondsAgo: 0, requestId: null },
  });
});

test("validateHeartbeatBody: endedSecondsAgo is optional, whole, and within a day", () => {
  const opts = { maxSeconds: 3600 };
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: null }, opts).value.endedSecondsAgo, 0);
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: 120 }, opts).value.endedSecondsAgo, 120);
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: 86400 }, opts).value.endedSecondsAgo, 86400);
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: "9" }, opts).errors[0].message, "endedSecondsAgo must be a whole number");
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: 1.2 }, opts).errors[0].message, "endedSecondsAgo must be a whole number");
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: -1 }, opts).errors[0].message, "endedSecondsAgo must not be negative");
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: 86401 }, opts).errors[0].message, "endedSecondsAgo must not be more than 86400");
  assert.equal(
    validateHeartbeatBody({ activeSeconds: 5, endedSecondsAgo: 61 }, { maxSeconds: 3600, maxEndedSecondsAgo: 60 }).errors[0].message,
    "endedSecondsAgo must not be more than 60"
  );
});

test("validateHeartbeatBody: requestId is optional and limited to a safe alphabet", () => {
  const opts = { maxSeconds: 3600 };
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, requestId: null }, opts).value.requestId, null);
  assert.equal(validateHeartbeatBody({ activeSeconds: 5, requestId: "abc-123_x.y:z" }, opts).value.requestId, "abc-123_x.y:z");
  for (const bad of ["", "a b", "x".repeat(65), 12, "semi;colon"]) {
    const result = validateHeartbeatBody({ activeSeconds: 5, requestId: bad }, opts);
    assert.equal(result.value, null, `requestId ${JSON.stringify(bad)}`);
    assert.equal(result.errors[0].field, "requestId");
  }
});

test("validateHeartbeatBody: reports every failed rule together", () => {
  const result = validateHeartbeatBody({ activeSeconds: 0, endedSecondsAgo: -1, requestId: "no spaces" }, { maxSeconds: 3600 });
  assert.deepEqual(fields(result), ["activeSeconds", "endedSecondsAgo", "requestId"]);
});

test("toIsoDate: reads the shapes the apps write", () => {
  assert.equal(toIsoDate("2026-10-27"), "2026-10-27");
  assert.equal(toIsoDate("2026-10-27T10:20:30.000Z"), "2026-10-27");
  assert.equal(toIsoDate("27 October, 2026"), "2026-10-27");
  assert.equal(toIsoDate("5 Oct 2026"), "2026-10-05");
  assert.equal(toIsoDate("  7 May 2026 "), "2026-05-07");
  assert.equal(toIsoDate("October 27, 2026"), "2026-10-27");
  assert.equal(toIsoDate("Oct 3 2026"), "2026-10-03");
});

test("toIsoDate: falls back to Date parsing, then to an empty text", () => {
  assert.equal(toIsoDate("Tue Oct 27 2026 10:00:00"), "2026-10-27");
  assert.equal(toIsoDate("Smarch 5, 2026"), "");
  assert.equal(toIsoDate("5 Smarch 2026"), "");
  assert.equal(toIsoDate("not a date"), "");
  assert.equal(toIsoDate(""), "");
  assert.equal(toIsoDate(null), "");
  assert.equal(toIsoDate(42), "");
});
