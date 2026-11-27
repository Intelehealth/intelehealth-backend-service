const express = require("express");
const router = express.Router();
const { recordHeartbeat } = require("../controllers/achievement.controller");
const authMiddleware = require("../middleware/auth");

/**
 * Activity APIs
 */
router.post("/heartbeat", [authMiddleware, recordHeartbeat]);

module.exports = router;
