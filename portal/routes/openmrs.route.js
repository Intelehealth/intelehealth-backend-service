const express = require("express");
const authMiddleware = require("../middleware/auth");
const router = express.Router();
const { getVisitCounts,getFollowupVisits } = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", [authMiddleware, getVisitCounts]);
router.get("/getFollowupVisits", [authMiddleware, getFollowupVisits]);

module.exports = router;
