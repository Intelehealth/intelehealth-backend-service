const express = require("express");

const controller = require("../controllers/doctor.controller");
const { authenticate } = require("../middleware/auth");
const { selfOrAdmin } = require("../middleware/authorize");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../utils/apiResponse");
const { DOCTOR_STATUS } = require("../constants");

const router = express.Router();

/** /api/doctor/:doctorUuid/status — backend LLD §09.3. */

router.use(authenticate);

router.patch(
  "/:doctorUuid/status",
  // §13.1 — a doctor can only change their own status; overriding someone
  // else's requires an admin role.
  selfOrAdmin("doctorUuid"),
  validateBody({
    status: { type: "string", required: true, enum: Object.values(DOCTOR_STATUS) },
    speciality: { type: "string", maxLength: 100 },
  }),
  asyncHandler(controller.updateStatus)
);

router.get("/:doctorUuid/status", asyncHandler(controller.getStatus));

module.exports = router;
