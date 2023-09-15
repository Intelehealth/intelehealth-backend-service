const express = require("express");
const router = express.Router();
const { 
    getVisitCounts,
    getPriorityVisits,
    getInProgressVisits,
    getCompletedVisits 
} = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", getVisitCounts);
router.get("/getPriorityVisits", getPriorityVisits);
router.get("/getInProgressVisits", getInProgressVisits);
router.get("/getCompletedVisits", getCompletedVisits);

module.exports = router;
