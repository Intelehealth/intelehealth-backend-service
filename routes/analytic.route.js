const express = require("express");
const router = express.Router();
const {
  trackAction,
  getActions,
} = require("../controllers/analytic.controller");

router.post("/action", trackAction);
router.get("/:userUuid", getActions);

module.exports = router;
