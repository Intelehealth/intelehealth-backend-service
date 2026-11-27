const express = require("express");
const router = express.Router();

// Paths mirror the Mobilab External API: /mobilab/v1/... -> MOBILAB_BASE_URL/v1/...
router.use("/v1/auth", require("./auth.route"));
router.use("/v1", require("./catalog.route"));
router.use("/v1/clinics", require("./clinic.route"));
router.use("/v1", require("./user.route"));
router.use("/v1/bookings", require("./booking.route"));
router.use("/v1/reports", require("./report.route"));

module.exports = router;
