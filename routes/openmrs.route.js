const express = require("express");
const router = express.Router();
const { getVisitCounts } = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", getVisitCounts);

module.exports = router;
