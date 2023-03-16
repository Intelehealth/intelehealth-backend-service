const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  sendSMS
} = require("../controllers/message.controller");

router.post("/sendMessage", sendMessage);
router.get("/:fromUser/:toUser/:patientId", getMessages);
router.post("/sendSMS", sendSMS);

module.exports = router;
