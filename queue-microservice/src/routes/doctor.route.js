const express = require("express");

const controller = require("../controllers/doctor.controller");
const { authenticate } = require("../middleware/auth");
const { selfOrAdmin, adminOnly } = require("../middleware/authorize");
const { validateBody, validateQuery } = require("../middleware/validate");
const { asyncHandler } = require("../utils/apiResponse");
const { DOCTOR_STATUS } = require("../constants");

const router = express.Router();

/** /api/doctor/:doctorUuid/status — backend LLD §09.3. */

// in_consult is deliberately absent: the queue sets it on assignment, with the
// case pointer. A client may only toggle presence.
const SETTABLE_STATUSES = [DOCTOR_STATUS.ONLINE, DOCTOR_STATUS.AWAY, DOCTOR_STATUS.OFFLINE];

const updateStatusSchema = {
  status: { type: "string", required: true, enum: SETTABLE_STATUSES },
  speciality: { type: "string", maxLength: 100 },
};

const listStatusesSchema = {
  speciality: { type: "string", maxLength: 100 },
  status: { type: "string", enum: Object.values(DOCTOR_STATUS) },
};

router.use(authenticate);

// Admin/ops view of every doctor QMS knows about. Declared before the
// /:doctorUuid routes for readability; the paths do not overlap.
router.get("/status", adminOnly, validateQuery(listStatusesSchema), asyncHandler(controller.listStatuses));

router.patch(
  "/:doctorUuid/status",
  // §13.1 — a doctor can only change their own status; overriding someone
  // else's requires an admin role.
  selfOrAdmin("doctorUuid"),
  validateBody(updateStatusSchema),
  asyncHandler(controller.updateStatus)
);

router.get("/:doctorUuid/status", asyncHandler(controller.getStatus));

// The request schemas are attached to the exported router so the tests can
// validate against the real definitions.
router.schemas = { updateStatus: updateStatusSchema, listStatuses: listStatusesSchema };

module.exports = router;
