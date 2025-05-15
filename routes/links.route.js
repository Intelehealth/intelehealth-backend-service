const express = require("express");
const router = express.Router();

const {
  shortLink,
  getLink,
  requestOtp,
  verifyOtp,
  getDoctorDocument,
} = require("../controllers/links.controller");

router.post("/shortLink", shortLink);
router.get("/getLink/:hash", getLink);
router.post("/requestOtp", requestOtp);
router.post("/verifyOtp", verifyOtp);
router.get("/getDoctorDocument/:hash", getDoctorDocument);

module.exports = router;
