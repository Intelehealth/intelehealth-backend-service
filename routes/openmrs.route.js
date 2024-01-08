const express = require("express");
const router = express.Router();
const {
  getVisitCounts,
  getFollowUpVisit,
  forgetPasswordSendOtp,
  forgetPasswordResetPassword,
  getAwaitingVisits,
  getPriorityVisits,
  getInProgressVisits,
  getCompletedVisits,
  getEndedVisits
} = require("../controllers/openMrs.controller");

router.get("/getVisitCounts", getVisitCounts);
router.get("/getFollowUpVisit/:providerId", getFollowUpVisit);
router.post("/forgetPassword/requestOtp", forgetPasswordSendOtp);
router.post(
  "/forgetPassword/resetPassword/:userUuid",
  forgetPasswordResetPassword
);

/**
 * Visit APIs
 */
router.get("/getAwaitingVisits", getAwaitingVisits);
router.get("/getPriorityVisits", getPriorityVisits);
router.get("/getInProgressVisits", getInProgressVisits);
router.get("/getCompletedVisits", getCompletedVisits);
router.get("/getEndedVisits", getEndedVisits);

module.exports = router;
