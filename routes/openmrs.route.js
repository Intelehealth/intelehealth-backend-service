const express = require("express");
const router = express.Router();
const {
  // getVisitCounts,
  getLocations,
  getDoctorDetails,
} = require("../controllers/openMrs.controller");

// router.get("/getVisitCounts", getVisitCounts);
router.get("/getLocations", getLocations);
router.get("/getDoctorDetails", getDoctorDetails);

module.exports = router;
