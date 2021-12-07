const express = require("express");
const router = express.Router();
const {
  // getVisitCounts,
  getLocations,
} = require("../controllers/openMrs.controller");

// router.get("/getVisitCounts", getVisitCounts);
router.get("/getLocations", getLocations);

module.exports = router;
