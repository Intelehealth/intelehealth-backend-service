const express = require("express");
const router = express.Router();
const {
  main,
  joinRoom,
  checkRoom,
  turn,
  messageClientInRoom,
  leaveRoom,
} = require("../controllers/webrtc.controller");

router.get("/", main);
router.post("/join/:roomId", joinRoom);
router.post("/message/:roomId/:clientId", messageClientInRoom);
router.post("/turn", turn);
router.post("/leave/:roomId/:clientId", leaveRoom);
router.get("/r/:roomId", checkRoom);

module.exports = router;
