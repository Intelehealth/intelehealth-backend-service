const express = require("express");
const router = express.Router();
const {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
  getNotificationStatus,
  toggleNotificationStatus
} = require("../controllers/notification.controller");

router.put("/snooze_notification", snoozeNotification);
router.put("/user_settings", setUserSettings);
router.get("/user_settings/:uuid", getUserSettings);
router.get("/getNotificationStatus/:uuid", getNotificationStatus);
router.put("/toggleNotificationStatus/:uuid", toggleNotificationStatus);


module.exports = router;
