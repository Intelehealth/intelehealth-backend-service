const express = require("express");
const {
  getAppointmentSchedule,
  upsertSchedule,
  getAppointmentSlots,
  bookAppointment,
} = require("../controllers/appointment.controller");
const router = express.Router();

router.post("/createOrUpdateSchedule", upsertSchedule);
router.get("/getSchedule/:userUuid", getAppointmentSchedule);
router.get("/getAppointmentSlots", getAppointmentSlots);
router.post("/bookAppointment", bookAppointment);

module.exports = router;
