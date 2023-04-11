const express = require("express");
const router = express.Router();
const {
  getLocations,
  getDoctorDetails,
  getVisitCounts,
  getDoctorVisits,
  getBaselineSurveyPatients,
  getAwaitingVisits,
  getPriorityVisits,
  getInProgressVisits,
  getCompletedVisits,
} = require("../controllers/openMrs.controller");

// router.get("/getVisitCounts", getVisitCounts);
router.get("/getLocations", getLocations);
router.get("/getDoctorDetails", getDoctorDetails);
router.get("/getVisitCounts", getVisitCounts);
router.get("/getDoctorVisits", getDoctorVisits);
router.get(
  "/getBaselineSurveyPatients/:location_id",
  getBaselineSurveyPatients
);

/**
 * Visit APIs
 */
router.get("/getAwaitingVisits", getAwaitingVisits);
router.get("/getPriorityVisits", getPriorityVisits);
router.get("/getInProgressVisits", getInProgressVisits);
router.get("/getCompletedVisits", getCompletedVisits);

module.exports = router;
