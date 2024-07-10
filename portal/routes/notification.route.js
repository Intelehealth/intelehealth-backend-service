const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  snoozeNotification,
  getUserSettings,
  setUserSettings,
} = require("../controllers/notification.controller");

router.put("/snooze_notification", [authMiddleware,snoozeNotification]);
router.put("/user_settings", [authMiddleware,setUserSettings]);
router.get("/user_settings/:uuid", [authMiddleware,getUserSettings]);

module.exports = router;
