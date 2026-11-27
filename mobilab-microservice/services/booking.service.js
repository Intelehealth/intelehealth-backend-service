const { callMobilab } = require("../handlers/axiosHelper");

const bookingPath = (bookingId) => `/v1/bookings/${encodeURIComponent(bookingId)}`;

/**
 * GET /v1/bookings
 * @param {object} params - status, start_date, end_date, limit, offset
 */
async function getBookings(params) {
  return callMobilab({ method: "GET", url: "/v1/bookings", params });
}

/**
 * POST /v1/bookings - patient is auto-created from patient_phone.
 * assigned_to set = single phlebotomist; omitted/null = whole clinic.
 * @param {object} payload
 */
async function createBooking(payload) {
  return callMobilab({ method: "POST", url: "/v1/bookings", data: payload });
}

/**
 * GET /v1/bookings/{booking_id}
 * @param {string} bookingId - our booking reference, e.g. BK-2026-00142
 */
async function getBooking(bookingId) {
  return callMobilab({ method: "GET", url: bookingPath(bookingId) });
}

/**
 * PATCH /v1/bookings/{booking_id} - reassign / move clinic / update vitals
 * @param {string} bookingId
 * @param {object} payload
 */
async function updateBooking(bookingId, payload) {
  return callMobilab({ method: "PATCH", url: bookingPath(bookingId), data: payload });
}

/**
 * GET /v1/bookings/{booking_id}/results
 * @param {string} bookingId
 */
async function getBookingResults(bookingId) {
  return callMobilab({ method: "GET", url: `${bookingPath(bookingId)}/results` });
}

/**
 * PATCH /v1/bookings/{booking_id}/readings/{id} - approve / reject / repeat
 * @param {string} bookingId
 * @param {number} readingId - tests[].id from the results response
 * @param {object} payload - action, remarks
 */
async function updateReadingStatus(bookingId, readingId, payload) {
  return callMobilab({
    method: "PATCH",
    url: `${bookingPath(bookingId)}/readings/${encodeURIComponent(readingId)}`,
    data: payload
  });
}

module.exports = {
  getBookings,
  createBooking,
  getBooking,
  updateBooking,
  getBookingResults,
  updateReadingStatus
};
