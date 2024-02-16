const express = require("express");
const router = express.Router();
const {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
  notifyApp,
} = require("../controllers/notification.controller");
const authMiddleware = require("../middleware/auth");

router.put("/snooze_notification", [authMiddleware, snoozeNotification]);
router.put("/user_settings", [authMiddleware, setUserSettings]);
router.get("/user_settings/:uuid", [authMiddleware, getUserSettings]);

router.post("/notify-app/:userId", [authMiddleware, notifyApp]);

module.exports = router;
