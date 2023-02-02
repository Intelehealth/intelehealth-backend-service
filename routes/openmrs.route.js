const express = require("express");
const router = express.Router();
const {
  getVisitCounts,
  getFollowUpVisit,
  forgetPasswordSendOtp,
  forgetPasswordResetPassword,
} = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", getVisitCounts);
router.get("/getFollowUpVisit/:providerId", getFollowUpVisit);
router.post("/forgetPassword/requestOtp", forgetPasswordSendOtp);
router.post(
  "/forgetPassword/resetPassword/:userUuid",
  forgetPasswordResetPassword
);

module.exports = router;
