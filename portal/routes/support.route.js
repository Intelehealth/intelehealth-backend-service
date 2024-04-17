const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  readMessage,
  getDoctorsList
} = require("../controllers/support.controller");
const authMiddleware = require("../middleware/auth");

router.post("/sendMessage", [authMiddleware, sendMessage]);
router.get("/getMessages/:from/:to", [authMiddleware, getMessages]);
router.put("/read/:userId/:messageId", [authMiddleware, readMessage]);
router.get("/getDoctorsList/:userId", [authMiddleware, getDoctorsList]);

module.exports = router;