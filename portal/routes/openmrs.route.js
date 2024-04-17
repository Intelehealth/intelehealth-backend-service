const express = require("express");
const router = express.Router();
const { 
    getVisitCounts,
    getPriorityVisits,
    getInProgressVisits,
    getCompletedVisits 
} = require("../controllers/openMrs.controller");
const authMiddleware = require("../middleware/auth");

router.get("/getVisitCounts", [authMiddleware, getVisitCounts]);
router.get("/getPriorityVisits", [authMiddleware, getPriorityVisits]);
router.get("/getInProgressVisits", [authMiddleware, getInProgressVisits]);
router.get("/getCompletedVisits", [authMiddleware, getCompletedVisits]);

module.exports = router;
