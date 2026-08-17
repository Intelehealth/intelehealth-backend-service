const analytics = require("../services/analytics.service");
const priorityConfig = require("../services/priorityConfig.service");
const models = require("../models");
const { success } = require("../utils/apiResponse");

/** Analytics and priority-config admin — backend LLD §09.4, Priority Engine §07. */

/** GET /api/queue/analytics/live */
const live = async (req, res) =>
  success(res, await analytics.live({ speciality: req.validatedQuery?.speciality }));

/** GET /api/queue/analytics/accuracy */
const accuracy = async (req, res) =>
  success(
    res,
    await analytics.accuracy({
      speciality: req.validatedQuery?.speciality,
      doctorUuid: req.validatedQuery?.doctorUuid,
      sinceHours: req.validatedQuery?.sinceHours,
    })
  );

/** GET /api/queue/config — the live priority configuration. */
const getConfig = async (_req, res) => success(res, priorityConfig.get());

/**
 * PUT /api/queue/config — admin re-tune.
 * Validated before it is stored: Σweights ≠ 1.0 is rejected outright rather
 * than accepted and run miscalibrated (Priority Engine §07).
 */
const updateConfig = async (req, res) => {
  const updated = await priorityConfig.update(models, req.body?.config || req.body, {
    updatedBy: req.auth?.userUuid || null,
    note: req.body?.note || null,
  });
  return success(res, updated, 200, "Priority config updated and reloaded");
};

module.exports = { live, accuracy, getConfig, updateConfig };
