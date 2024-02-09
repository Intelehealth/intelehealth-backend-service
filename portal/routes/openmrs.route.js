const express = require("express");
const router = express.Router();
const { getVisitCounts,getFollowupVisits } = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", getVisitCounts);
router.get("/getFollowupVisits", getFollowupVisits);

module.exports = router;
