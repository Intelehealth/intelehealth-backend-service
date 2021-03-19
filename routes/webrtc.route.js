const express = require("express");
const router = express.Router();
const {
  main,
  joinRoom,
  checkRoom,
} = require("../controllers/webrtc.controller");

router.get("/", main);
router.post("/join/:roomId", joinRoom);
router.post("/message/:roomId/:clientId", joinRoom);
router.get("/r/:roomId", checkRoom);

module.exports = router;
