const { ForbiddenError } = require("../utils/errors");

/**
 * Backend LLD §13.1 — "who's allowed to press which button".
 *
 * The rule from the doc, verbatim in effect: a doctor can only change their own
 * online/offline status, and only an admin role can override someone else's
 * status or cancel a case on a patient's behalf. Everything else rides the
 * existing login token, so this is one extra check, not a new login system.
 */

/** The authenticated caller must be the user named in req.params[param]. */
const selfOrAdmin = (param) => (req, _res, next) => {
  const target = req.params[param];
  if (req.auth?.isAdmin) return next();
  if (req.auth?.userUuid && target && req.auth.userUuid === target) return next();
  return next(
    new ForbiddenError(
      "You can only change your own status; overriding another user requires an admin role",
      "NOT_SELF"
    )
  );
};

const adminOnly = (req, _res, next) => {
  if (req.auth?.isAdmin) return next();
  return next(new ForbiddenError("Admin role required", "ADMIN_REQUIRED"));
};

/**
 * Ownership check for an already-loaded queue entry: the health worker who
 * submitted it, the doctor it is assigned to, or an admin.
 */
const assertCaseAccess = (auth, entry) => {
  if (auth?.isAdmin) return;
  const uuid = auth?.userUuid;
  if (!uuid) throw new ForbiddenError("No user identity on this token", "NO_IDENTITY");
  if (uuid === entry.hwUserUuid) return;
  if (entry.assignedDoctorUuid && uuid === entry.assignedDoctorUuid) return;
  throw new ForbiddenError("This case belongs to another user", "NOT_CASE_OWNER");
};

module.exports = { selfOrAdmin, adminOnly, assertCaseAccess };
