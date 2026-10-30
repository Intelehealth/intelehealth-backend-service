"use strict";
const { PERIODS, DEFAULTS, MAX_ENDED_SECONDS_AGO } = require("../constants/achievement.constant");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Read the settings used by the achievement APIs. A missing, non-numeric
 * or non-positive value falls back to the default.
 * @param {object} env - environment variables
 */
const getConfig = (env = process.env) => {
  const positive = (value, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const offset = Number.parseInt(env.ACHIEVEMENTS_TZ_OFFSET_MINUTES, 10);
  return {
    tzOffsetMinutes: Number.isFinite(offset) ? offset : DEFAULTS.TZ_OFFSET_MINUTES,
    heartbeatMaxSeconds: positive(env.HEARTBEAT_MAX_SECONDS, DEFAULTS.HEARTBEAT_MAX_SECONDS),
    maxRangeDays: positive(env.ACHIEVEMENTS_MAX_RANGE_DAYS, DEFAULTS.MAX_RANGE_DAYS),
  };
};

/**
 * True only for a real calendar date written as YYYY-MM-DD (2026-02-30 fails).
 * @param {*} value
 */
const isRealDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

const toUtcMs = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * Number of days from..to counting both ends.
 */
const daysInclusive = (from, to) => Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS) + 1;

/**
 * Add days to a YYYY-MM-DD date.
 */
const addDays = (value, days) =>
  new Date(toUtcMs(value) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Today's date (YYYY-MM-DD) in the zone given by an offset from UTC.
 * @param {Date} now
 * @param {number} offsetMinutes - for example 330 for IST
 */
const todayInOffset = (now, offsetMinutes) =>
  new Date(now.getTime() + offsetMinutes * 60 * 1000).toISOString().slice(0, 10);

/**
 * Validate the query string of the summary call.
 * All failed rules are returned together.
 * @param {object} query - req.query
 * @param {{ maxRangeDays: number, today: string }} options
 * @returns {{ errors: Array<{field: string, message: string}>, value: object }}
 */
const validateSummaryQuery = (query, { maxRangeDays, today }) => {
  const errors = [];
  const source = query && typeof query === "object" ? query : {};

  const read = (name) => {
    const raw = source[name];
    if (raw === undefined) return { present: false };
    if (typeof raw !== "string") {
      errors.push({ field: name, message: `${name} must be a single value` });
      return { present: true, invalid: true };
    }
    return { present: true, value: raw };
  };

  const from = read("from");
  const to = read("to");
  const period = read("period");

  if (from.present !== to.present) {
    errors.push({
      field: from.present ? "to" : "from",
      message: "from and to must be sent together",
    });
  }

  let fromOk = false;
  let toOk = false;
  if (from.present && !from.invalid) {
    fromOk = isRealDate(from.value);
    if (!fromOk) errors.push({ field: "from", message: "from must be a valid date in YYYY-MM-DD format" });
  }
  if (to.present && !to.invalid) {
    toOk = isRealDate(to.value);
    if (!toOk) errors.push({ field: "to", message: "to must be a valid date in YYYY-MM-DD format" });
  }

  if (fromOk && toOk) {
    if (from.value > to.value) {
      errors.push({ field: "from", message: "from must not be after to" });
    } else if (daysInclusive(from.value, to.value) > maxRangeDays) {
      errors.push({ field: "to", message: `Date range cannot be longer than ${maxRangeDays} days` });
    }
  }

  let periodOk = false;
  if (period.present && !period.invalid) {
    periodOk = PERIODS.includes(period.value);
    if (!periodOk) errors.push({ field: "period", message: "period must be today or overall" });
  }
  if (periodOk && period.value === "overall" && (from.present || to.present)) {
    errors.push({ field: "period", message: "period cannot be combined with from and to" });
  }

  if (errors.length) return { errors, value: null };

  if (period.present && period.value === "overall") {
    return { errors, value: { period: "overall", from: null, to: null } };
  }
  if (from.present && to.present) {
    return { errors, value: { period: "range", from: from.value, to: to.value } };
  }
  return { errors, value: { period: "today", from: today, to: today } };
};

/**
 * Validate the body of the heartbeat call.
 * All failed rules are returned together.
 * @param {*} body - req.body
 * @param {{ maxSeconds: number, maxEndedSecondsAgo?: number }} options
 * @returns {{ errors: Array<{field: string, message: string}>, value: object|null }}
 */
const validateHeartbeatBody = (body, { maxSeconds, maxEndedSecondsAgo = MAX_ENDED_SECONDS_AGO }) => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
      value: null,
    };
  }

  const errors = [];
  const seconds = body.activeSeconds;
  if (seconds === undefined || seconds === null) {
    errors.push({ field: "activeSeconds", message: "activeSeconds is required" });
  } else if (typeof seconds !== "number" || !Number.isInteger(seconds)) {
    errors.push({ field: "activeSeconds", message: "activeSeconds must be a whole number" });
  } else if (seconds < 1) {
    errors.push({ field: "activeSeconds", message: "activeSeconds must be at least 1" });
  } else if (seconds > maxSeconds) {
    errors.push({ field: "activeSeconds", message: `activeSeconds must not be more than ${maxSeconds}` });
  }

  // Optional: how many seconds ago the period ended. Left out (0) for a beat sent as soon as its
  // period ends; set for seconds that waited, for example while the app was offline.
  const ago = body.endedSecondsAgo;
  let endedSecondsAgo = 0;
  if (ago !== undefined && ago !== null) {
    if (typeof ago !== "number" || !Number.isInteger(ago)) {
      errors.push({ field: "endedSecondsAgo", message: "endedSecondsAgo must be a whole number" });
    } else if (ago < 0) {
      errors.push({ field: "endedSecondsAgo", message: "endedSecondsAgo must not be negative" });
    } else if (ago > maxEndedSecondsAgo) {
      errors.push({ field: "endedSecondsAgo", message: `endedSecondsAgo must not be more than ${maxEndedSecondsAgo}` });
    } else {
      endedSecondsAgo = ago;
    }
  }

  // Optional: an id that is the same when the same request is sent again, so a replay adds nothing.
  const id = body.requestId;
  let requestId = null;
  if (id !== undefined && id !== null) {
    if (typeof id !== "string" || !REQUEST_ID_PATTERN.test(id)) {
      errors.push({
        field: "requestId",
        message: "requestId must be 1 to 64 characters: letters, digits, . _ : -",
      });
    } else {
      requestId = id;
    }
  }

  if (errors.length) return { errors, value: null };
  return { errors, value: { activeSeconds: seconds, endedSecondsAgo, requestId } };
};

const MONTH_MAP = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08",
  sep: "09", oct: "10", nov: "11", dec: "12",
};

const pad = (n) => String(n).padStart(2, "0");

/**
 * Read the "createdDate" patient attribute into YYYY-MM-DD.
 * Accepts only explicit formats: an ISO date or date-time, "27 October, 2026" and
 * "October 27, 2026" (full or three-letter month). Anything else, such as "05/10/2026", is not
 * guessed at: Date would read it as May 10 where the apps mean 5 October, and could not read
 * "27/10/2026" at all. The caller counts the values that come back as "".
 * Returns "" when the value cannot be read.
 * @param {string} value
 */
const toIsoDate = (value) => {
  if (!value || typeof value !== "string") return "";
  const text = value.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const dayMonthYear = text.match(/^(\d{1,2})\s+(\w+),?\s+(\d{4})$/);
  if (dayMonthYear) {
    const month = MONTH_MAP[dayMonthYear[2].toLowerCase()];
    if (month) return `${dayMonthYear[3]}-${month}-${pad(dayMonthYear[1])}`;
  }

  const monthDayYear = text.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYear) {
    const month = MONTH_MAP[monthDayYear[1].toLowerCase()];
    if (month) return `${monthDayYear[3]}-${month}-${pad(monthDayYear[2])}`;
  }

  return "";
};

module.exports = {
  getConfig,
  isRealDate,
  daysInclusive,
  addDays,
  todayInOffset,
  validateSummaryQuery,
  validateHeartbeatBody,
  toIsoDate,
};
