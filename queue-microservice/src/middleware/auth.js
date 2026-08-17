const fs = require("fs");
const jwt = require("jsonwebtoken");

const config = require("../config/env");
const logger = require("../utils/logger");
const { UnauthorizedError } = require("../utils/errors");

let cachedKey = null;

/**
 * Shared RSA public key, signed by OpenMRS/auth-gateway — the same scheme
 * portal, web-rtc and pagerduty already use. .pem/ is gitignored; the same
 * public_key.pem must be copied in on each deployment.
 */
const publicKey = () => {
  if (cachedKey) return cachedKey;
  try {
    cachedKey = fs.readFileSync(config.auth.publicKeyPath, "utf8");
  } catch (err) {
    logger.error("Unable to read JWT public key", { path: config.auth.publicKeyPath });
    throw new UnauthorizedError("Token verification is not configured", "JWT_KEY_MISSING");
  }
  return cachedKey;
};

const bearerToken = (req) => {
  const header = req.headers.authorization || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
};

const rolesFrom = (payload) => {
  const raw = payload.roles || payload.role || payload.authorities || [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((r) => String(r).toLowerCase());
};

/**
 * Accepts EITHER a valid user JWT (doctor / HW / patient apps) OR the
 * x-qms-secret header (internal service callers such as web-rtc and portal).
 *
 * Sets req.auth = { type, userUuid, roles, isAdmin, isService }.
 */
const authenticate = (req, _res, next) => {
  const serviceSecret = req.headers["x-qms-secret"];
  if (serviceSecret) {
    if (!config.auth.serviceSecret || serviceSecret !== config.auth.serviceSecret) {
      return next(new UnauthorizedError("Invalid service secret", "INVALID_SERVICE_SECRET"));
    }
    req.auth = {
      type: "service",
      userUuid: null,
      roles: ["service"],
      // Internal services act on behalf of the platform, not a person.
      isAdmin: true,
      isService: true,
    };
    return next();
  }

  const token = bearerToken(req);
  if (!token) {
    return next(new UnauthorizedError("Missing Authorization bearer token or x-qms-secret"));
  }

  try {
    const payload = jwt.verify(token, publicKey(), { algorithms: config.auth.algorithms });
    const roles = rolesFrom(payload);
    req.auth = {
      type: "user",
      userUuid: payload.userId || payload.user_uuid || payload.uuid || payload.sub || null,
      roles,
      isAdmin: roles.some((r) => config.auth.adminRoles.includes(r)),
      isService: false,
      token: payload,
    };
    return next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    return next(new UnauthorizedError("Invalid or expired token", "INVALID_TOKEN"));
  }
};

module.exports = { authenticate, publicKey };
