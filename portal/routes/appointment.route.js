const authMiddleware = require("../middleware/auth");

const express = require("express");

const {
  getAppointmentSchedule,
  upsertSchedule,
  getAppointmentSlots,
  bookAppointment,
  getUserSlots,
  cancelAppointment,
  getAppointment,
  getSlots,
  rescheduleAppointment,
  getAllSlotsBwDates,
} = require("../controllers/appointment.controller");


const router = express.Router();


router.post("/createOrUpdateSchedule", [authMiddleware, upsertSchedule]);
router.get("/getSchedule/:userUuid", [authMiddleware, getAppointmentSchedule ]);
router.get("/getUserSlots/:userUuid", [authMiddleware, getUserSlots]);
router.get("/getSlots", [authMiddleware, getSlots]);
router.get("/getAllSlotsBwDates", [authMiddleware, getAllSlotsBwDates]);
router.get("/getAppointmentSlots", [authMiddleware, getAppointmentSlots]);
router.post("/bookAppointment", [authMiddleware, bookAppointment]);
router.post("/cancelAppointment", [authMiddleware, cancelAppointment]);
router.get("/getAppointment/:visitUuid", [authMiddleware, getAppointment]);
router.post("/rescheduleAppointment", [authMiddleware, rescheduleAppointment]);

module.exports = router;
