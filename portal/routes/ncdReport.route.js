const express = require("express");
const router = express.Router();

const {
  getNcdReportDataByPatient,
} = require("../controllers/ncdReport.controller");

router.get("/r/:patientUuid", getNcdReportDataByPatient);

module.exports = router;
