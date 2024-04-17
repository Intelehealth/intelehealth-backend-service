const express = require("express");
const router = express.Router();
const {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
  getNotificationStatus,
  toggleNotificationStatus,
} = require("../controllers/notification.controller");
const authMiddleware = require("../middleware/auth");

router.put("/snooze_notification/:uuid", [authMiddleware, snoozeNotification]);
router.put("/user_settings", [authMiddleware, setUserSettings]);
router.get("/user_settings/:uuid", [authMiddleware, getUserSettings]);
router.get("/getNotificationStatus/:uuid", [authMiddleware, getNotificationStatus]);
router.put("/toggleNotificationStatus/:uuid", [authMiddleware, toggleNotificationStatus]);

module.exports = router;
