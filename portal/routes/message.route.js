const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/auth');
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
router.get("/:fromUser/:toUser/:patientId", [authMiddleware, getMessages]);
router.get("/:fromUser/:toUser", [authMiddleware, getAllMessages]);
router.get("/getPatientMessageList", [authMiddleware, getPatientMessageList]);
router.put("/read/:messageId", [authMiddleware, readMessagesById]);
router.get("/:patientId", [authMiddleware, getVisits]);
router.post("/sendSMS", sendSMS);

module.exports = router;