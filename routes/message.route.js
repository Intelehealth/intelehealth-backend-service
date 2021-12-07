const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
} = require("../controllers/message.controller");

router.post("/sendMessage", sendMessage);
router.get("/:fromUser/:toUser/:patientId", getMessages);

module.exports = router;
