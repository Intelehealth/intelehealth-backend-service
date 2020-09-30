const express = require("express");
const router = express.Router();
const { snoozeNotification } = require("../controllers/notification.controller");

router.put("/snooze_notification", snoozeNotification);

module.exports = router;
