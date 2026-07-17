const express = require("express");
const {
  getAvailableSlots,
  getUserAppointmentSlots,
  bookAppointment,
} = require("../controllers/turn-appointment.controller");
const turnAuthMiddleware = require("../middleware/turn-auth");
const router = express.Router();

router.get("/getAvailableSlots", [turnAuthMiddleware, getAvailableSlots]);
router.get("/getUserAppointmentSlots/:userUuid", [turnAuthMiddleware, getUserAppointmentSlots]);
router.post("/bookAppointment", [turnAuthMiddleware, bookAppointment]);

module.exports = router;
