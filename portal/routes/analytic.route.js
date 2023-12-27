const express = require("express");
const router = express.Router();
const {
  trackAction,
  getActions,
} = require("../controllers/analytic.controller");

const authMiddleware = require("../middleware/auth");

router.post("/action", [authMiddleware, trackAction]);
router.get("/:userUuid", [authMiddleware, getActions]);

module.exports = router;
