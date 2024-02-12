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
const authMiddleware = require("../middleware/auth");

router.get("/getVisitCounts", [authMiddleware, getVisitCounts]);
router.get("/getFollowUpVisit/:providerId", [authMiddleware, getFollowUpVisit]);
router.post("/forgetPassword/requestOtp", forgetPasswordSendOtp);
router.post(
  "/forgetPassword/resetPassword/:userUuid",
  forgetPasswordResetPassword
);

/**
 * Visit APIs
 */
router.get("/getAwaitingVisits", [authMiddleware, getAwaitingVisits]);
router.get("/getPriorityVisits", [authMiddleware, getPriorityVisits]);
router.get("/getInProgressVisits", [authMiddleware, getInProgressVisits]);
router.get("/getCompletedVisits", [authMiddleware, getCompletedVisits]);
router.get("/getEndedVisits", [authMiddleware, getEndedVisits]);

module.exports = router;
