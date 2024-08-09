const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

const {
  shortLink,
  getLink,
  requestOtp,
  verifyOtp,
  getFacilityContactsList,
  getFacilityContactById
} = require("../controllers/links.controller");

router.post("/shortLink", shortLink);
router.get("/getLink/:hash", getLink);
router.post("/requestOtp", requestOtp);
router.post("/verifyOtp", verifyOtp);
router.get("/getFacilityContacts", [authMiddleware, getFacilityContactsList]);
router.get("/getFacilityContacts/:id", [authMiddleware, getFacilityContactById]);

module.exports = router;
