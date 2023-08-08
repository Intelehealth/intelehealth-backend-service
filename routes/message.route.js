const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getAllMessages,
  getPatientMessageList,
  readMessagesById,
  getVisits,
  upload,
} = require("../controllers/message.controller");
const { fileParser } = require("../handlers/file.handler");

router.post("/sendMessage", sendMessage);
router.post("/upload", fileParser, upload);
// router.get("/:fromUser/:toUser/:patientId", getMessages);
router.get("/:fromUser/:toUser/:patientId", getMessages);
router.get("/:fromUser/:toUser", getAllMessages);
router.get("/getPatientMessageList", getPatientMessageList);
router.put("/read/:messageId", readMessagesById);
router.get("/:patientId", getVisits);

module.exports = router;
