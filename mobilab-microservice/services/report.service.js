const { callMobilab } = require("../handlers/axiosHelper");

/**
 * GET /v1/reports/{booking_id} - presigned PDF URL (valid ~1 hour).
 * Mobilab returns 404 until the report has been generated.
 * @param {string} bookingId
 */
async function getReportUrl(bookingId) {
  return callMobilab({ method: "GET", url: `/v1/reports/${encodeURIComponent(bookingId)}` });
}

module.exports = {
  getReportUrl
};
