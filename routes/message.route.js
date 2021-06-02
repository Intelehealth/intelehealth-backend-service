const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getMessagesWithoutPatient,
} = require("../controllers/message.controller");

router.post("/sendMessage", sendMessage);
router.get("/:fromUser/:toUser/:patientId", getMessages);
router.get("/:fromUser/:toUser", getMessagesWithoutPatient);

module.exports = router;
