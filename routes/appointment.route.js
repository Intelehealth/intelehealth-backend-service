const express = require("express");
const {
  getAppointmentSchedule,
  upsertSchedule,
  getAppointmentSlots,
  bookAppointment,
  getUserSlots,
  getSpecialitySlots,
  cancelAppointment,
  getAppointment,
  getSlots,
  rescheduleAppointment,
  startAppointment,
  releaseAppointment
} = require("../controllers/appointment.controller");
const router = express.Router();

router.get("/getAppointment/:visitUuid", getAppointment);
router.get("/getSchedule/:userUuid", getAppointmentSchedule);
router.get("/getUserSlots/:userUuid", getUserSlots);
router.get("/getSpecialitySlots/:speciality", getSpecialitySlots);
router.get("/getSlots", getSlots);
router.get("/getAppointmentSlots", getAppointmentSlots);

router.post("/createOrUpdateSchedule", upsertSchedule);
router.post("/bookAppointment", bookAppointment);
router.post("/rescheduleAppointment", rescheduleAppointment);
router.post("/startAppointment", startAppointment);
router.post("/releaseAppointment", releaseAppointment);
router.post("/cancelAppointment", cancelAppointment);

module.exports = router;
