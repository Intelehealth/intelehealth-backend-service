const catalogService = require("../services/catalog.service");
const { sendResponse } = require("../handlers/responseHandler");
const { logStream } = require("../logger");

/**
 * Get lab tests catalog
 * @param {*} req
 * @param {*} res
 */
const getLabTests = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Lab Tests");
    const apiResponse = await catalogService.getLabTests(req.query);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Get lab profiles catalog
 * @param {*} req
 * @param {*} res
 */
const getLabProfiles = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Lab Profiles");
    const apiResponse = await catalogService.getLabProfiles(req.query);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

module.exports = {
  getLabTests,
  getLabProfiles
};
