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
const authMiddleware = require("../middleware/auth");

router.post("/sendMessage",  [authMiddleware, sendMessage]);
router.post("/upload",  [authMiddleware, fileParser, upload]);
// router.get("/:fromUser/:toUser/:patientId", getMessages);
router.get("/:fromUser/:toUser/:patientId",  [authMiddleware, getMessages]);
router.get("/:fromUser/:toUser",  [authMiddleware, getAllMessages]);
router.get("/getPatientMessageList",  [authMiddleware, getPatientMessageList]);
router.put("/read/:messageId",  [authMiddleware, readMessagesById]);
router.get("/:patientId",  [authMiddleware, getVisits]);

module.exports = router;
