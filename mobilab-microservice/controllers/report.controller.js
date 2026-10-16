const reportService = require("../services/report.service");
const { sendResponse } = require("../handlers/responseHandler");
const { logStream } = require("../logger");

/**
 * Get presigned report PDF URL
 * @param {*} req
 * @param {*} res
 */
const getReportUrl = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Report Url");
    const apiResponse = await reportService.getReportUrl(req.params.booking_id);
    // Presigned URL expires - don't let browsers/proxies cache it
    res.set("Cache-Control", "no-store");
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

module.exports = {
  getReportUrl
};
