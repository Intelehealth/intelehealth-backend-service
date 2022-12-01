const express = require("express");
const router = express.Router();
const {
  getVisitCounts,
  forgetPasswordSendOtp,
  forgetPasswordResetPassword,
} = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", getVisitCounts);
router.post("/forgetPassword/requestOtp", forgetPasswordSendOtp);
router.post(
  "/forgetPassword/resetPassword/:userUuid",
  forgetPasswordResetPassword
);

module.exports = router;
