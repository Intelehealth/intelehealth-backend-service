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
  releaseAppointment,
  completeAppointment,
  getScheduledMonths,
  updateDaysOff,
  appointmentPush,
  checkAppointment,
  updateSlotSpeciality,
  validateDayOff
} = require("../controllers/appointment.controller");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

router.get("/getAppointment/:visitUuid", [authMiddleware, getAppointment]);
router.get("/getSchedule/:userUuid", [authMiddleware, getAppointmentSchedule]);
router.get("/getUserSlots/:userUuid", [authMiddleware, getUserSlots]);
router.get("/checkAppointment/:userUuid", [authMiddleware, checkAppointment]);
router.put("/updateSlotSpeciality/:userUuid", [authMiddleware, updateSlotSpeciality]);
router.get("/getSpecialitySlots/:speciality", [authMiddleware, getSpecialitySlots]);
router.get('/validateDayOff/:userUuid', [authMiddleware, validateDayOff]);
router.get("/getSlots", [authMiddleware, getSlots]);
router.get("/getAppointmentSlots", [authMiddleware, getAppointmentSlots]);
router.get("/getScheduledMonths/:userUuid", [authMiddleware, getScheduledMonths]);
router.post("/createOrUpdateSchedule", [authMiddleware, upsertSchedule]);
router.post("/bookAppointment", bookAppointment); // TODO: removed the authMiddleware it's calling from MRS middleware pull/push
router.post("/rescheduleAppointment", rescheduleAppointment); // TODO: removed the authMiddleware it's calling from MRS middleware pull/push
router.post("/startAppointment", [authMiddleware, startAppointment]);
router.post("/releaseAppointment", [authMiddleware, releaseAppointment]);
router.post("/cancelAppointment", [authMiddleware, cancelAppointment]);
router.post("/completeAppointment", [authMiddleware, completeAppointment]);
router.post("/updateDaysOff", [authMiddleware, updateDaysOff]);
router.post("/push", [authMiddleware, appointmentPush]);

module.exports = router;
