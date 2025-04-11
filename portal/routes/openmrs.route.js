const express = require("express");
const router = express.Router();
const {
  getVisitCounts,
  getVisitCountsForDashboard,
  getFollowUpVisit,
  forgetPasswordSendOtp,
  forgetPasswordResetPassword,
  getAwaitingVisits,
  getPriorityVisits,
  getInProgressVisits,
  getCompletedVisits,
  getEndedVisits,
  getLocations,
  getDoctorsVisit,
  getFollowUpLogVisits,
  getFollowUpLogVisitsByDoctor,
  updateLocationAttributes
} = require("../controllers/openMrs.controller");
const authMiddleware = require("../middleware/auth");

router.get("/getVisitCounts/:userId", [authMiddleware, getVisitCounts]);
router.get("/getVisitCountsForDashboard", [authMiddleware, getVisitCountsForDashboard]);
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
router.get("/getDoctorsVisit/:userId", [authMiddleware, getDoctorsVisit]);
router.get("/getFollowUpLogVisits", [authMiddleware, getFollowUpLogVisits]);
router.get("/getFollowUpLogVisits/:userId", [authMiddleware, getFollowUpLogVisitsByDoctor]);

/**
 * Location API
 */
router.get("/getLocations", [authMiddleware, getLocations]);
router.post("/location/:locationId", [authMiddleware, updateLocationAttributes]);

module.exports = router;
