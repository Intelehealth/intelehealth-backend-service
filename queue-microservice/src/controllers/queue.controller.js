const queueService = require("../services/queue.service");
const { success } = require("../utils/apiResponse");
const { assertCaseAccess } = require("../middleware/authorize");
const { ForbiddenError, BadRequestError } = require("../utils/errors");

/** Request handlers for /api/queue/* — backend LLD §09.1 and §09.2. */

/**
 * POST /api/queue/submit
 * Called right after a visit is uploaded to OpenMRS. Scores priority, checks
 * for a free doctor, and either hands back READY immediately or enqueues.
 * Safe to call twice by accident — dedupes on visitUuid.
 */
const submit = async (req, res) => {
  const body = req.validated;

  // A health worker submits as themselves. Internal services and admins may
  // submit on someone's behalf (LLD §13.1).
  if (!req.auth.isAdmin && !req.auth.isService) {
    if (body.hwUserUuid && body.hwUserUuid !== req.auth.userUuid) {
      throw new ForbiddenError("You can only submit cases as yourself", "NOT_SELF");
    }
    body.hwUserUuid = req.auth.userUuid;
  }
  if (!body.hwUserUuid) {
    throw new BadRequestError("hwUserUuid is required", "VALIDATION_ERROR");
  }

  const result = await queueService.submit({ ...body, vitals: req.body.vitals });
  // 200 rather than 201 on a dedupe: nothing new was created.
  return success(res, result, result.deduped ? 200 : 201);
};

/** GET /api/queue/:queueEntryId/status — poll fallback and reconnect resync. */
const getStatus = async (req, res) => {
  const entry = await queueService.findEntry(req.params.queueEntryId);
  assertCaseAccess(req.auth, entry);
  return success(res, await queueService.getStatus(entry.id));
};

/** DELETE /api/queue/:queueEntryId — HW withdraws the case. */
const cancel = async (req, res) => {
  const entry = await queueService.findEntry(req.params.queueEntryId);
  assertCaseAccess(req.auth, entry);
  const source = req.auth.isAdmin && req.auth.userUuid !== entry.hwUserUuid ? "ADMIN" : "HW";
  return success(res, await queueService.cancel(entry.id, { reason: req.body?.reason, source }));
};

/** POST /api/queue/:queueEntryId/heartbeat — keep-alive. */
const heartbeat = async (req, res) => {
  const entry = await queueService.findEntry(req.params.queueEntryId);
  assertCaseAccess(req.auth, entry);
  return success(res, await queueService.heartbeat(entry.id));
};

/**
 * GET /api/queue/list
 * All queue items, or one speciality's, in the order the queue is served.
 * Admins and internal services see everything; anyone else is scoped to cases
 * they submitted or are assigned to (LLD §13.1).
 */
const list = async (req, res) =>
  success(res, await queueService.listQueue(req.validatedQuery || {}, req.auth));

/**
 * GET /api/queue/specialities
 * Speciality-wise counts — the "what's pending where" view, optionally with a
 * preview of the top cases in each.
 */
const specialities = async (req, res) =>
  success(res, await queueService.specialitySummary(req.validatedQuery || {}, req.auth));

/** GET /api/queue/doctor/:doctorUuid/list — the doctor queue panel. */
const listForDoctor = async (req, res) => {
  const { doctorUuid } = req.params;
  if (!req.auth.isAdmin && !req.auth.isService && req.auth.userUuid !== doctorUuid) {
    throw new ForbiddenError("You can only read your own queue", "NOT_SELF");
  }
  const { speciality, locationUuid, limit, offset } = req.validatedQuery || {};
  return success(
    res,
    await queueService.listForDoctor(doctorUuid, { speciality, locationUuid, limit, offset })
  );
};

/**
 * POST /api/queue/:queueEntryId/claim
 * Exactly one of two simultaneous claims wins; the loser gets a 409 with
 * CASE_ALREADY_CLAIMED so the webapp can say so instead of failing silently.
 */
const claim = async (req, res) => {
  const doctorUuid = req.validated?.doctorUuid || req.auth.userUuid;
  if (!doctorUuid) throw new BadRequestError("doctorUuid is required", "VALIDATION_ERROR");
  if (!req.auth.isAdmin && !req.auth.isService && doctorUuid !== req.auth.userUuid) {
    throw new ForbiddenError("You can only claim a case for yourself", "NOT_SELF");
  }
  return success(res, await queueService.claim(req.params.queueEntryId, doctorUuid));
};

/** POST /api/queue/doctor/:doctorUuid/next — hand me the next patient. */
const claimNext = async (req, res) => {
  const { doctorUuid } = req.params;
  if (!req.auth.isAdmin && !req.auth.isService && doctorUuid !== req.auth.userUuid) {
    throw new ForbiddenError("You can only claim a case for yourself", "NOT_SELF");
  }
  const result = await queueService.claimNext(doctorUuid, req.validated || {});
  if (!result) return success(res, { case: null }, 200, "No case waiting for this speciality");
  return success(res, result);
};

/** POST /api/queue/:queueEntryId/release — hand the case back, unpenalised. */
const release = async (req, res) => {
  const doctorUuid = req.validated?.doctorUuid || req.auth.userUuid;
  return success(
    res,
    await queueService.release(req.params.queueEntryId, doctorUuid, {
      reason: req.validated?.reason,
    })
  );
};

/** POST /api/queue/:queueEntryId/complete — consultation finished. */
const complete = async (req, res) => {
  const doctorUuid = req.validated?.doctorUuid || req.auth.userUuid;
  return success(res, await queueService.complete(req.params.queueEntryId, doctorUuid));
};

/**
 * POST /api/queue/:queueEntryId/connecting and /connected.
 * The web-rtc call-lifecycle hooks: these are what drive a case through
 * CONNECTING → CONNECTED without QMS ever calling web-rtc itself.
 */
const markConnecting = async (req, res) =>
  success(res, await queueService.markConnecting(req.params.queueEntryId));

const markConnected = async (req, res) =>
  success(res, await queueService.markConnected(req.params.queueEntryId));

/** POST /api/queue/:queueEntryId/requeue — call failed; back in line with a bump. */
const requeue = async (req, res) =>
  success(
    res,
    await queueService.requeue(req.params.queueEntryId, { reason: req.validated?.reason })
  );

module.exports = {
  submit,
  getStatus,
  cancel,
  heartbeat,
  list,
  specialities,
  listForDoctor,
  claim,
  claimNext,
  release,
  complete,
  markConnecting,
  markConnected,
  requeue,
};
