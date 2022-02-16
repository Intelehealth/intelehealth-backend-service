const express = require("express");
const router = express.Router();
const {
  getStatuses,
  createUpdateStatus,
  getAllStatuses,
} = require("../controllers/user.controller");

router.post("/createUpdateStatus", createUpdateStatus);
router.get("/getStatuses/:userUuid", getStatuses);
router.get("/getAllStatuses", getAllStatuses);

module.exports = router;
