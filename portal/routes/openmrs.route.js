const express = require("express");
const authMiddleware = require("../middleware/auth");
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
  updateLocationAttributes
} = require("../controllers/openMrs.controller");


router.get("/getLocations", [authMiddleware, getLocations]);
router.get("/getDoctorDetails", [authMiddleware, getDoctorDetails]);
router.get("/getVisitCounts", [authMiddleware, getVisitCounts]);
router.get("/getDoctorVisits", [authMiddleware, getDoctorVisits]);
router.get(
  "/getBaselineSurveyPatients/:location_id",
  [authMiddleware, getBaselineSurveyPatients]
);

/**
 * Visit APIs
 */
router.get("/getAwaitingVisits", [authMiddleware, getAwaitingVisits]);
router.get("/getPriorityVisits", [authMiddleware, getPriorityVisits]);
router.get("/getInProgressVisits", [authMiddleware, getInProgressVisits]);
router.get("/getCompletedVisits", [authMiddleware, getCompletedVisits]);

/**
 * Location API
 */
router.post("/location/:locationId", [authMiddleware, updateLocationAttributes]);

module.exports = router;
