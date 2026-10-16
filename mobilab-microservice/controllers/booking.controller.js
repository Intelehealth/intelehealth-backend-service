const bookingService = require("../services/booking.service");
const { sendResponse } = require("../handlers/responseHandler");
const { logStream } = require("../logger");

/**
 * Get bookings list
 * @param {*} req
 * @param {*} res
 */
const getBookings = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Bookings");
    const apiResponse = await bookingService.getBookings(req.query);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Create booking
 * @param {*} req
 * @param {*} res
 */
const createBooking = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Create Booking");
    const apiResponse = await bookingService.createBooking(req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Get booking by booking_id
 * @param {*} req
 * @param {*} res
 */
const getBooking = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Booking");
    const apiResponse = await bookingService.getBooking(req.params.booking_id);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Update booking
 * @param {*} req
 * @param {*} res
 */
const updateBooking = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Update Booking");
    const apiResponse = await bookingService.updateBooking(req.params.booking_id, req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Get booking test results
 * @param {*} req
 * @param {*} res
 */
const getBookingResults = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Booking Results");
    const apiResponse = await bookingService.getBookingResults(req.params.booking_id);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Approve / reject / repeat a test reading
 * @param {*} req
 * @param {*} res
 */
const updateReadingStatus = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Update Reading Status");
    const { booking_id, id } = req.params;
    const apiResponse = await bookingService.updateReadingStatus(booking_id, id, req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

module.exports = {
  getBookings,
  createBooking,
  getBooking,
  updateBooking,
  getBookingResults,
  updateReadingStatus
};
