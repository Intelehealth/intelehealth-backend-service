const clinicService = require("../services/clinic.service");
const { sendResponse } = require("../handlers/responseHandler");
const { logStream } = require("../logger");

/**
 * Get clinics list
 * @param {*} req
 * @param {*} res
 */
const getClinics = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Clinics");
    const apiResponse = await clinicService.getClinics(req.query);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Create clinic
 * @param {*} req
 * @param {*} res
 */
const createClinic = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Create Clinic");
    const apiResponse = await clinicService.createClinic(req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Upload clinic file (license / gst / logo)
 * @param {*} req
 * @param {*} res
 */
const uploadClinicFile = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Upload Clinic File");
    const apiResponse = await clinicService.uploadClinicFile(req.file, req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Get clinic by id
 * @param {*} req
 * @param {*} res
 */
const getClinic = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Clinic");
    const apiResponse = await clinicService.getClinic(req.params.id);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Update clinic
 * @param {*} req
 * @param {*} res
 */
const updateClinic = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Update Clinic");
    const apiResponse = await clinicService.updateClinic(req.params.id, req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

module.exports = {
  getClinics,
  createClinic,
  uploadClinicFile,
  getClinic,
  updateClinic
};
