const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getAllMessages,
  getPatientMessageList,
  readMessagesById,
} = require("../controllers/message.controller");

router.post("/sendMessage", sendMessage);
// router.get("/:fromUser/:toUser/:patientId", getMessages);
router.get("/:fromUser/:toUser/:patientId/:visitId?", getMessages);
router.get("/:fromUser/:toUser", getAllMessages);
router.get("/getPatientMessageList", getPatientMessageList);
router.put("/read/:messageId", readMessagesById);

module.exports = router;
