const express = require("express");
const authMiddleware = require('../middleware/auth');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getAllMessages,
  getPatientMessageList,
  readMessagesById,
  getVisits,
} = require("../controllers/message.controller");

router.post("/sendMessage", [authMiddleware, sendMessage]);
router.get("/:fromUser/:toUser/:patientId", [authMiddleware, getMessages]);
router.get("/:fromUser/:toUser", [authMiddleware, getAllMessages]);
router.get("/getPatientMessageList", [authMiddleware, getPatientMessageList]);
router.put("/read/:messageId", [authMiddleware, readMessagesById]);
router.get("/:patientId", [authMiddleware, getVisits]);

module.exports = router;
