const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const ignoredRoutes = require("../../IGNORED_ROUTES");

/**
 * Authentication — same scheme as the other Intelehealth services (portal, web-rtc,
 * pagerduty): a `Bearer <JWT>` signed by OpenMRS/auth, verified with the shared RSA
 * public key at `.pem/public_key.pem`.
 *
 * This service also accepts internal service-to-service calls (from web-rtc, portal)
 * via the `x-qms-secret` header, since those backend callers have no user token.
 * A request passes if it presents EITHER a valid service secret OR a valid user JWT.
 */

// Load the same public_key.pem used across the other services. Read lazily-guarded
// so a missing key gives a clear message instead of crashing the whole process.
let publicKey = null;
try {
  publicKey = fs.readFileSync(
    path.join(__dirname, "../../", ".pem", "public_key.pem"),
    { encoding: "utf8", flag: "r" }
  );
} catch (err) {
  console.warn(
    "[qms] WARNING: .pem/public_key.pem not found — JWT auth will reject all user tokens. " +
      "Copy the same public_key.pem used by the other services into queue-microservice/.pem/"
  );
}

function verifyUserJwt(req) {
  const authorizationHeader = req.header("Authorization");
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return { ok: false, message: "Invalid authorization header" };
  }
  const token = authorizationHeader.replace("Bearer ", "");
  if (!token) return { ok: false, message: "Authorization token not found" };
  if (!publicKey) return { ok: false, message: "Auth public key not configured" };
  try {
    const decoded = jwt.verify(token, publicKey);
    return { ok: true, decoded };
  } catch (err) {
    return { ok: false, message: "Invalid token" };
  }
}

const authMiddleware = (req, res, next) => {
  if (ignoredRoutes.includes(req.path)) return next();

  // 1) service-to-service: internal callers present the shared secret
  const serviceSecret = process.env.QMS_SERVICE_SECRET;
  if (serviceSecret && req.get("x-qms-secret") === serviceSecret) {
    req.caller = "service";
    return next();
  }

  // 2) user apps: require a valid JWT
  const result = verifyUserJwt(req);
  if (!result.ok) {
    return res.status(401).json({ success: false, message: result.message, code: 401 });
  }
  req.user = result.decoded;
  req.caller = "user";
  next();
};

module.exports = authMiddleware;
