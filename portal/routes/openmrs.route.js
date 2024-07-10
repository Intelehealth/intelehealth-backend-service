const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { getVisitCounts, getLocations } = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", [authMiddleware, getVisitCounts]);
router.get("/getLocations", [authMiddleware, getLocations]);

module.exports = router;
