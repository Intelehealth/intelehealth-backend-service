const express = require("express");

const controller = require("../controllers/queue.controller");
const analyticsController = require("../controllers/analytics.controller");
const { authenticate } = require("../middleware/auth");
const { adminOnly } = require("../middleware/authorize");
const { submitLimiter, heartbeatLimiter } = require("../middleware/rateLimit");
const { validateBody, validateQuery, validateParams } = require("../middleware/validate");
const { asyncHandler } = require("../utils/apiResponse");
const { EMERGENCY_LEVEL, CASE_TYPE, SPEC_MATCH } = require("../constants");

const router = express.Router();

/**
 * /api/queue/* — backend LLD §09.
 *
 * Everything already in portal, web-rtc and auth-gateway stays as-is. In
 * particular, no route here calls web-rtc: the client calls getToken itself
 * after a claim (§01, §09.2, §11).
 */

const entryParams = validateParams({
  queueEntryId: { type: "integer", required: true, min: 1 },
});

const submitSchema = {
  visitUuid: { type: "string", required: true, maxLength: 64 },
  patientUuid: { type: "string", maxLength: 64 },
  hwUserUuid: { type: "string", maxLength: 64 },
  speciality: { type: "string", required: true, maxLength: 100 },
  locationUuid: { type: "string", maxLength: 64 },
  emergencyLevel: { type: "string", enum: Object.values(EMERGENCY_LEVEL), default: EMERGENCY_LEVEL.LOW },
  caseType: { type: "string", enum: Object.values(CASE_TYPE), default: CASE_TYPE.NEW },
  specMatch: { type: "string", enum: Object.values(SPEC_MATCH), default: SPEC_MATCH.EXACT },
  // Priority Engine §00 — an existing type-15 "Flagged" encounter. The caller
  // passes it; QMS never queries OpenMRS itself.
  flagged: { type: "boolean", default: false },
  chiefComplaint: { type: "string", maxLength: 2000 },
};

// Every route below requires either a user JWT or the internal service secret.
router.use(authenticate);

/* ── Analytics (LLD §09.4) — declared before the :queueEntryId routes ─────── */

router.get(
  "/analytics/live",
  validateQuery({ speciality: { type: "string", maxLength: 100 } }),
  asyncHandler(analyticsController.live)
);

router.get(
  "/analytics/accuracy",
  validateQuery({
    speciality: { type: "string", maxLength: 100 },
    doctorUuid: { type: "string", maxLength: 64 },
    sinceHours: { type: "number", default: 24, min: 1, max: 24 * 90 },
  }),
  asyncHandler(analyticsController.accuracy)
);

/* ── Priority config (Priority Engine §07) ───────────────────────────────── */

router.get("/config", asyncHandler(analyticsController.getConfig));
router.put("/config", adminOnly, asyncHandler(analyticsController.updateConfig));

/* ── Listing — all, or speciality-wise ───────────────────────────────────── */

router.get(
  "/list",
  validateQuery({
    // Named group (WAITING | ACTIVE | ALL) or a comma-separated list of
    // explicit statuses. Defaults to WAITING — the queue proper.
    status: { type: "string", maxLength: 200 },
    speciality: { type: "string", maxLength: 100 },
    locationUuid: { type: "string", maxLength: 64 },
    emergencyLevel: { type: "string", enum: Object.values(EMERGENCY_LEVEL) },
    caseType: { type: "string", enum: Object.values(CASE_TYPE) },
    hwUserUuid: { type: "string", maxLength: 64 },
    doctorUuid: { type: "string", maxLength: 64 },
    visitUuid: { type: "string", maxLength: 64 },
    escalated: { type: "boolean" },
    flagged: { type: "boolean" },
    heartbeatFlagged: { type: "boolean" },
    queuedFrom: { type: "string", maxLength: 40 },
    queuedTo: { type: "string", maxLength: 40 },
    sort: {
      type: "string",
      enum: ["priority", "queuedAt", "-queuedAt", "waitedLongest", "recent"],
      default: "priority",
    },
    // Live ETA costs a few queries per speciality on the page; turn it off for
    // a cheap poll that only needs positions.
    includeEta: { type: "boolean", default: true },
    // Priority Engine §01 — the raw score is a sort key, never a display value.
    // Honoured for admins and internal services only.
    includeScore: { type: "boolean", default: false },
    limit: { type: "integer", default: 50, min: 1, max: 200 },
    offset: { type: "integer", default: 0, min: 0 },
  }),
  asyncHandler(controller.list)
);

router.get(
  "/specialities",
  validateQuery({
    status: { type: "string", maxLength: 200 },
    speciality: { type: "string", maxLength: 100 },
    locationUuid: { type: "string", maxLength: 64 },
    withItems: { type: "boolean", default: false },
    itemsPerSpeciality: { type: "integer", default: 5, min: 1, max: 25 },
  }),
  asyncHandler(controller.specialities)
);

/* ── Doctor panel (LLD §09.2) ────────────────────────────────────────────── */

router.get(
  "/doctor/:doctorUuid/list",
  validateQuery({
    speciality: { type: "string", maxLength: 100 },
    locationUuid: { type: "string", maxLength: 64 },
    limit: { type: "integer", default: 50, min: 1, max: 200 },
    offset: { type: "integer", default: 0, min: 0 },
  }),
  asyncHandler(controller.listForDoctor)
);

router.post(
  "/doctor/:doctorUuid/next",
  validateBody({
    speciality: { type: "string", maxLength: 100 },
    locationUuid: { type: "string", maxLength: 64 },
  }),
  asyncHandler(controller.claimNext)
);

/* ── Health worker (LLD §09.1) ───────────────────────────────────────────── */

router.post("/submit", submitLimiter(), validateBody(submitSchema), asyncHandler(controller.submit));

router.get("/:queueEntryId/status", entryParams, asyncHandler(controller.getStatus));

router.delete(
  "/:queueEntryId",
  entryParams,
  validateBody({ reason: { type: "string", maxLength: 500 } }),
  asyncHandler(controller.cancel)
);

router.post(
  "/:queueEntryId/heartbeat",
  heartbeatLimiter(),
  entryParams,
  asyncHandler(controller.heartbeat)
);

/* ── Doctor case actions (LLD §09.2) ─────────────────────────────────────── */

router.post(
  "/:queueEntryId/claim",
  entryParams,
  validateBody({ doctorUuid: { type: "string", maxLength: 64 } }),
  asyncHandler(controller.claim)
);

router.post(
  "/:queueEntryId/release",
  entryParams,
  validateBody({
    doctorUuid: { type: "string", maxLength: 64 },
    reason: { type: "string", maxLength: 500 },
  }),
  asyncHandler(controller.release)
);

router.post(
  "/:queueEntryId/complete",
  entryParams,
  validateBody({ doctorUuid: { type: "string", maxLength: 64 } }),
  asyncHandler(controller.complete)
);

/* ── Call lifecycle hooks (driven by the existing web-rtc flow) ──────────── */

router.post("/:queueEntryId/connecting", entryParams, asyncHandler(controller.markConnecting));
router.post("/:queueEntryId/connected", entryParams, asyncHandler(controller.markConnected));
router.post(
  "/:queueEntryId/requeue",
  entryParams,
  validateBody({ reason: { type: "string", maxLength: 200 } }),
  asyncHandler(controller.requeue)
);

module.exports = router;
