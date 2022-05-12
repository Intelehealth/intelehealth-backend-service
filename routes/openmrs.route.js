const express = require("express");
const router = express.Router();
const {
  getLocations,
  getDoctorDetails,
  getVisitCounts,
  getDoctorVisits
} = require("../controllers/openMrs.controller");

// router.get("/getVisitCounts", getVisitCounts);
router.get("/getLocations", getLocations);
router.get("/getDoctorDetails", getDoctorDetails);
router.get("/getVisitCounts", getVisitCounts);
router.get("/getDoctorVisits", getDoctorVisits);


module.exports = router;
