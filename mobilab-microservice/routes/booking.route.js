const express = require("express");
const {
  getBookings,
  createBooking,
  getBooking,
  updateBooking,
  getBookingResults,
  updateReadingStatus
} = require("../controllers/booking.controller");
const {
  getBookingsSchema,
  bookingIdSchema,
  createBookingSchema,
  updateBookingSchema,
  readingIdSchema,
  updateReadingSchema
} = require("../schema/booking.schema");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validationMiddleware");
const router = express.Router();

router.get("/", [authMiddleware, validate(getBookingsSchema, "query"), getBookings]);
router.post("/", [authMiddleware, validate(createBookingSchema), createBooking]);
router.get("/:booking_id", [authMiddleware, validate(bookingIdSchema, "params"), getBooking]);
router.patch("/:booking_id", [authMiddleware, validate(bookingIdSchema, "params"), validate(updateBookingSchema), updateBooking]);
router.get("/:booking_id/results", [authMiddleware, validate(bookingIdSchema, "params"), getBookingResults]);
router.patch("/:booking_id/readings/:id", [authMiddleware, validate(readingIdSchema, "params"), validate(updateReadingSchema), updateReadingStatus]);

module.exports = router;
