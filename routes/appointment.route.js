const express = require("express");
const {
  getAppointmentSchedule,
  upsertSchedule,
  getAppointmentSlots,
  bookAppointment,
  getUserSlots,
  cancelAppointment,
  getAppointment,
} = require("../controllers/appointment.controller");
const router = express.Router();

router.post("/createOrUpdateSchedule", upsertSchedule);
router.get("/getSchedule/:userUuid", getAppointmentSchedule);
router.get("/getUserSlots/:userUuid", getUserSlots);
router.get("/getAppointmentSlots", getAppointmentSlots);
router.post("/bookAppointment", bookAppointment);
router.post("/cancelAppointment", cancelAppointment);
router.get("/getAppointment/:visitUuid", getAppointment);

module.exports = router;
