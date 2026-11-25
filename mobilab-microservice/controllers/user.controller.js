const userService = require("../services/user.service");
const { sendResponse } = require("../handlers/responseHandler");
const { logStream } = require("../logger");

/**
 * Get roles list
 * @param {*} req
 * @param {*} res
 */
const getRoles = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Roles");
    const apiResponse = await userService.getRoles(req.query);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Get users list
 * @param {*} req
 * @param {*} res
 */
const getUsers = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get Users");
    const apiResponse = await userService.getUsers(req.query);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Create user
 * @param {*} req
 * @param {*} res
 */
const createUser = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Create User");
    const apiResponse = await userService.createUser(req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Get user by id
 * @param {*} req
 * @param {*} res
 */
const getUser = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Get User");
    const apiResponse = await userService.getUser(req.params.id);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Update user
 * @param {*} req
 * @param {*} res
 */
const updateUser = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Update User");
    const apiResponse = await userService.updateUser(req.params.id, req.body);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Delete user (soft delete)
 * @param {*} req
 * @param {*} res
 */
const deleteUser = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Delete User");
    const apiResponse = await userService.deleteUser(req.params.id);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

module.exports = {
  getRoles,
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser
};
