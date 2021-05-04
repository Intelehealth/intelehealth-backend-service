const express = require("express");
const router = express.Router();
const {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
} = require("../controllers/notification.controller");

router.put("/snooze_notification", snoozeNotification);
router.put("/user_settings", setUserSettings);
router.get("/user_settings/:uuid", getUserSettings);

module.exports = router;
