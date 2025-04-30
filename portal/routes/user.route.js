const express = require("express");
const authMiddleware = require("../middleware/auth");
const router = express.Router();
const {
  getStatuses,
  createUpdateStatus,
  getAllStatuses,
  getWebrtcStatuses
} = require("../controllers/user.controller");

router.post("/createUpdateStatus", [authMiddleware, createUpdateStatus]);
router.get("/getStatuses/:userUuid", [authMiddleware, getStatuses]);
router.get("/getAllStatuses", [authMiddleware, getAllStatuses]);
router.get("/getWebrtcStatuses", [authMiddleware, getWebrtcStatuses]);

module.exports = router;
