const express = require("express");
const { getReportUrl } = require("../controllers/report.controller");
const { reportBookingIdSchema } = require("../schema/report.schema");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validationMiddleware");
const router = express.Router();

router.get("/:booking_id", [authMiddleware, validate(reportBookingIdSchema, "params"), getReportUrl]);

module.exports = router;
