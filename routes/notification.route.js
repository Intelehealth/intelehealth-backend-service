const express = require("express");
const router = express.Router();
const {
  snoozeNotification,
  getUserSettings,
} = require("../controllers/notification.controller");

router.put("/snooze_notification", snoozeNotification);
router.get("/user_settings/:uuid", getUserSettings);

module.exports = router;
