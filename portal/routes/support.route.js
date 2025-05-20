const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  readMessage,
  getDoctorsList,
  createTicket
} = require("../controllers/support.controller");

router.post("/sendMessage", sendMessage);
router.get("/getMessages/:from/:to", getMessages);
router.put("/read/:userId/:messageId", readMessage);
router.get("/getDoctorsList/:userId", getDoctorsList);
router.post("/createTicket/:userId", createTicket);


module.exports = router;
