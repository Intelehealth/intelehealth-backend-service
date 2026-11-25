const authService = require("../services/auth.service");
const { sendResponse } = require("../handlers/responseHandler");
const { logStream } = require("../logger");

/**
 * IH login through the auth gateway (Swagger UI helper)
 * @param {*} req
 * @param {*} res
 */
const ihLogin = async (req, res, next) => {
  try {
    logStream("debug", "API call", "IH Login");
    const { data } = await authService.ihLogin(req.body);
    if (!data?.status || !data?.token) {
      return res.status(401).json({ success: false, code: 401, message: "Invalid username or password" });
    }
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, token: data.token });
  } catch (error) {
    logStream("error", `IH Login---${error.message}`);
    // Gateway errors must not reach errorHandler, which reports axios errors as Mobilab's
    if (error?.isAxiosError) {
      const status = error?.response?.status ?? 502;
      return res.status(status).json({
        success: false,
        code: status,
        message: error?.response?.data?.message ?? "Auth gateway is unreachable, please try again later"
      });
    }
    next(error);
  }
};

/**
 * Issue a new Mobilab API key
 * @param {*} req
 * @param {*} res
 */
const issueToken = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Issue Token");
    console.log("auth api call - req.body", req.body);
    const apiResponse = await authService.issueApiKey(req.body);
    // The raw api_key is only returned once - never cache this response
    res.set("Cache-Control", "no-store");
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

/**
 * Revoke a Mobilab API key
 * @param {*} req
 * @param {*} res
 */
const revokeToken = async (req, res, next) => {
  try {
    logStream("debug", "API call", "Mobilab - Revoke Token");
    const apiResponse = await authService.revokeApiKey(req.body?.api_key);
    return sendResponse(res, apiResponse);
  } catch (error) {
    logStream("error", error.message);
    next(error);
  }
};

module.exports = {
  ihLogin,
  issueToken,
  revokeToken
};
