const express = require("express");
const router = express.Router();
const {
  getLocations,
  getDoctorDetails,
  getVisitCounts,
  getDoctorVisits,
  getBaselineSurveyPatients
} = require("../controllers/openMrs.controller");

// router.get("/getVisitCounts", getVisitCounts);
router.get("/getLocations", getLocations);
router.get("/getDoctorDetails", getDoctorDetails);
router.get("/getVisitCounts", getVisitCounts);
router.get("/getDoctorVisits", getDoctorVisits);
router.get("/getBaselineSurveyPatients/:location_id", getBaselineSurveyPatients);

module.exports = router;
