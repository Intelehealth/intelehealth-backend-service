const express = require("express");
const router = express.Router();
const { getFollowUpVisit } = require("../controllers/openmrs.controller");

router.get("/getFollowUpVisit/:providerId", getFollowUpVisit);

module.exports = router;
