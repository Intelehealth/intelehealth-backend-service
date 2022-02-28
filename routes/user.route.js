const express = require("express");
const router = express.Router();
const {
  getStatuses,
  createUpdateStatus,
  getAllStatuses,
  profile,
} = require("../controllers/user.controller");

router.post("/createUpdateStatus", createUpdateStatus);
router.get("/getStatuses/:userUuid", getStatuses);
router.get("/getAllStatuses", getAllStatuses);
router.get("/profile/:userUuid", profile);

module.exports = router;
