const { QueryTypes } = require("sequelize");

const models = require("../models");
const config = require("../config/env");
const logger = require("../utils/logger");
const { describeError } = require("../utils/errors");

/**
 * Who to push to, and on which devices.
 *
 * Device registration lives in portal's `user_settings.device_reg_token`, and
 * web-push subscriptions in `pushnotification.notification_object` — the same
 * two tables portal reads (see portal/services/appointment.service.js, which
 * joins user_settings on the health worker's uuid to get `token` and `locale`).
 *
 * Read with raw SQL rather than Sequelize models on purpose. Those tables
 * belong to portal, and QMS's models are declared `underscored: true`, which
 * would map `createdAt` to `created_at` and mismatch portal's schema. Raw
 * queries keep QMS from taking a schema dependency it does not own — and it is
 * exactly how portal itself reads them.
 */

const CACHE_TTL_MS = 10000;
const cache = new Map();

const now = () => Date.now();

/**
 * Portal's rule, copied from portal/controllers/message.controller.js:
 *   if (us?.snooze_till ? new Date().valueOf() > us?.snooze_till : true)
 * i.e. send when there is no snooze, or the snooze has already expired.
 */
const snoozeExpired = (snoozeTill) => {
  if (!snoozeTill) return true;
  const until = Number(snoozeTill);
  if (!Number.isFinite(until)) return true;
  return now() > until;
};

/**
 * @returns { userUuid, locale, tokens: string[], webpushSubs: string[], snoozed }
 *          or null when the user has no registered device at all.
 */
const forUser = async (userUuid) => {
  if (!userUuid) return null;

  const cached = cache.get(userUuid);
  if (cached && now() - cached.at < CACHE_TTL_MS) return cached.value;

  let settings = [];
  let subs = [];

  try {
    settings = await models.sequelize.query(
      `SELECT device_reg_token AS token, locale, snooze_till
         FROM user_settings
        WHERE user_uuid = :userUuid`,
      { replacements: { userUuid }, type: QueryTypes.SELECT }
    );
  } catch (err) {
    // The table belongs to portal; if QMS is pointed at a database without it,
    // say so once and carry on rather than failing the queue operation.
    logger.warn("user_settings unreadable — cannot resolve push tokens", {
      error: describeError(err),
    });
    return null;
  }

  if (config.push.webPushEnabled) {
    try {
      subs = await models.sequelize.query(
        `SELECT notification_object AS webpush_obj, locale
           FROM pushnotification
          WHERE user_uuid = :userUuid`,
        { replacements: { userUuid }, type: QueryTypes.SELECT }
      );
    } catch (err) {
      logger.debug("pushnotification unreadable — skipping web push", { error: describeError(err) });
    }
  }

  const snoozed = settings.length > 0 && !settings.some((row) => snoozeExpired(row.snooze_till));

  const value = {
    userUuid,
    locale: settings.find((row) => row.locale)?.locale || subs.find((row) => row.locale)?.locale || "en",
    // Portal's call sites simply check `if (token)` before sending; same here.
    tokens: [...new Set(settings.map((row) => row.token).filter(Boolean))],
    webpushSubs: subs.map((row) => row.webpush_obj).filter(Boolean),
    snoozed,
  };

  if (!value.tokens.length && !value.webpushSubs.length) {
    cache.set(userUuid, { at: now(), value: null });
    return null;
  }

  cache.set(userUuid, { at: now(), value });
  return value;
};

/** Resolve many users at once, sharing the short-lived cache. */
const forUsers = async (userUuids) => {
  const out = new Map();
  for (const uuid of new Set(userUuids.filter(Boolean))) {
    out.set(uuid, await forUser(uuid));
  }
  return out;
};

/** Test hook / used after a device re-registers. */
const invalidate = (userUuid) => {
  if (userUuid) cache.delete(userUuid);
  else cache.clear();
};

module.exports = { forUser, forUsers, invalidate, snoozeExpired };
