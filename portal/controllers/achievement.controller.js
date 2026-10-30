"use strict";
const { MESSAGE } = require("../constants/messages");
const {
  getConfig,
  todayInOffset,
  validateSummaryQuery,
  validateHeartbeatBody,
} = require("../services/achievement-validation");
const { HttpError } = require("../services/achievement.service");

/**
 * Build the controller. The service, logger and clock are passed in so the
 * controller can be tested without a database.
 * @param {object} deps
 * @param {() => object} deps.getService - returns the achievement service
 * @param {(type: string, data: string, prefix?: string) => void} deps.log
 * @param {() => Date} [deps.now]
 * @param {() => object} [deps.getSettings]
 */
const createAchievementController = ({
  getService,
  log,
  now = () => new Date(),
  getSettings = getConfig,
}) => {
  const userUuidOf = (req) => req && req.user && req.user.data && req.user.data.userId;

  const fail = (res, code, message, extra = {}) =>
    res.status(code).json({ success: false, message, code, ...extra });

  const validationFailed = (res, errors) =>
    fail(res, 400, MESSAGE.ACHIEVEMENT.VALIDATION_FAILED, { errors });

  const handleError = (res, error, route, userUuid) => {
    if (error instanceof HttpError) {
      // Say which user was refused, so a missing provider can be traced in the log.
      if (error.code === 403) {
        log("info", `${route}: ${error.message} (OpenMRS user ${userUuid})`, "Achievements");
      }
      return fail(res, error.code, error.message);
    }
    // The detail goes to the log only. The token is never logged.
    log("error", `${route} failed: ${error && error.message}`, "Achievements");
    return fail(res, 500, MESSAGE.ACHIEVEMENT.INTERNAL_ERROR);
  };

  /**
   * GET /openmrs/achievements/summary
   * Values for the Achievements panel of the logged-in health worker.
   */
  const getSummary = async (req, res) => {
    try {
      const userUuid = userUuidOf(req);
      if (!userUuid) return fail(res, 401, MESSAGE.ACHIEVEMENT.INVALID_TOKEN);

      const settings = getSettings();
      const { errors, value } = validateSummaryQuery(req.query, {
        maxRangeDays: settings.maxRangeDays,
        today: todayInOffset(now(), settings.tzOffsetMinutes),
      });
      if (errors.length) return validationFailed(res, errors);

      const data = await getService().getSummary({ userUuid, range: value });
      return res.status(200).json({
        success: true,
        message: MESSAGE.ACHIEVEMENT.SUMMARY_FETCHED_SUCCESSFULLY,
        data,
      });
    } catch (error) {
      return handleError(res, error, "GET achievements summary", userUuidOf(req));
    }
  };

  /**
   * POST /activity/heartbeat
   * Adds active seconds to today's total of the logged-in health worker.
   */
  const recordHeartbeat = async (req, res) => {
    try {
      const userUuid = userUuidOf(req);
      if (!userUuid) return fail(res, 401, MESSAGE.ACHIEVEMENT.INVALID_TOKEN);

      const { errors, value } = validateHeartbeatBody(req.body, {
        maxSeconds: getSettings().heartbeatMaxSeconds,
      });
      if (errors.length) return validationFailed(res, errors);

      const data = await getService().recordHeartbeat({
        userUuid,
        activeSeconds: value.activeSeconds,
        endedSecondsAgo: value.endedSecondsAgo,
        requestId: value.requestId,
      });
      return res.status(200).json({
        success: true,
        message: MESSAGE.ACHIEVEMENT.HEARTBEAT_RECORDED_SUCCESSFULLY,
        data,
      });
    } catch (error) {
      return handleError(res, error, "POST activity heartbeat", userUuidOf(req));
    }
  };

  return { getSummary, recordHeartbeat };
};

let defaultController = null;

/**
 * The controller wired to the real service and logger. Created on first use.
 */
const getAchievementController = () => {
  if (!defaultController) {
    const { getAchievementService } = require("../services/achievement.service");
    const { logStream } = require("../logger/index");
    defaultController = createAchievementController({
      getService: getAchievementService,
      log: logStream,
    });
  }
  return defaultController;
};

// Thin wrappers so the routes can import plain handlers.
const getSummary = (req, res) => getAchievementController().getSummary(req, res);
const recordHeartbeat = (req, res) => getAchievementController().recordHeartbeat(req, res);

module.exports = { createAchievementController, getSummary, recordHeartbeat };
