const express = require("express");
const router = express.Router();
const { getNcdReportData } = require("../controllers/ncdReport.controller");
const authMiddleware = require("../middleware/auth");

/**
 * NCD Report API
 * Get NCD report data for a patient including BP, HB, and RBS readings
 */
router.get("/r/:patientUuid", [authMiddleware, getNcdReportData]);

module.exports = router;
