const express = require("express");
const router = express.Router();
const {
  getStatuses,
  createUpdateStatus,
} = require("../controllers/user.controller");

router.post("/createUpdateStatus", createUpdateStatus);
router.get("/getStatuses/:userUuid", getStatuses);

module.exports = router;
