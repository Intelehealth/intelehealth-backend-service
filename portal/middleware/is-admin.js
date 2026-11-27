const { checkIfSystemAdmin } = require("../services/support.service");
const { logStream } = require("../logger/index");

/**
 * Gates a route to OpenMRS system administrators only.
 *
 * The JWT this app issues (see auth-gateway/controller/auth.controller.js)
 * carries only { sessionId, userId, name } - no role or privilege claims -
 * so admin status can't be read off the token itself. checkIfSystemAdmin
 * already does the real check via a role lookup against the OpenMRS DB, the
 * same one support.controller.js relies on for its admin-only flows.
 */
const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user && req.user.data && req.user.data.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    const admin = await checkIfSystemAdmin(userId);
    if (!admin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    next();
  } catch (err) {
    logStream("error", err.message, "IsAdmin");
    return res.status(500).json({ success: false, message: "Could not verify admin access" });
  }
};

module.exports = isAdmin;
