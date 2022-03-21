const express = require("express");
const router = express.Router();
const {
  getStatuses,
  createUpdateStatus,
  getAllStatuses,
  profile,
  updateProfile,
} = require("../controllers/user.controller");

router.post("/createUpdateStatus", createUpdateStatus);
router.get("/getStatuses/:userUuid", getStatuses);
router.get("/getAllStatuses", getAllStatuses);
router.get("/profile/:userUuid", profile);
router.put("/profile/:userUuid", updateProfile);

module.exports = router;
