const express = require("express");
const authMiddleware = require("../middleware/auth");
const router = express.Router();
const {
  getStatuses,
  createUpdateStatus,
  getAllStatuses
} = require("../controllers/user.controller");

router.post("/createUpdateStatus", [authMiddleware, createUpdateStatus]);
router.get("/getStatuses/:userUuid", [authMiddleware, getStatuses]);
router.get("/getAllStatuses", [authMiddleware, getAllStatuses]);

module.exports = router;
