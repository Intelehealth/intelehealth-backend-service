const authMiddleware = require("../middleware/auth");
const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getAllMessages,
  getPatientMessageList,
  readMessagesById,
  getVisits,
  // upload,
} = require("../controllers/message.controller");
// const { fileParser } = require("../handlers/file.handler");

router.post("/sendMessage", [authMiddleware, sendMessage]);
// router.post("/upload", fileParser, upload);
// router.get("/:fromUser/:toUser/:patientId", getMessages);
router.get("/:fromUser/:toUser/:patientId", [authMiddleware, getMessages]);
router.get("/:fromUser/:toUser", [authMiddleware, getAllMessages]);
router.get("/getPatientMessageList", [authMiddleware,getPatientMessageList]);
router.put("/read/:messageId", [authMiddleware, readMessagesById]);
router.get("/:patientId", [authMiddleware, getVisits]);
router.post("/sendSMS", [authMiddleware, sendSMS]);

module.exports = router;
