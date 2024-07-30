const express = require("express");
const router = express.Router();
const {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
  getNotificationStatus,
  toggleNotificationStatus,
  notifyApp,
  clearNotification,
  acknowledgeNotification
} = require("../controllers/notification.controller");

router.put("/snooze_notification/:uuid", snoozeNotification);
router.put("/user_settings", setUserSettings);
router.get("/user_settings/:uuid", getUserSettings);
router.get("/getNotificationStatus/:uuid", getNotificationStatus);
router.put("/toggleNotificationStatus/:uuid", toggleNotificationStatus);
router.post("/notify-app/:userId", notifyApp);
router.put("/acknowledge/:id", acknowledgeNotification);
router.delete("/clearAll/:userId", clearNotification);

module.exports = router;
