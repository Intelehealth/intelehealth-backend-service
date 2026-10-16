const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const ignoredRoutes = require("../IGNORED_ROUTES");
const publicKey = fs.readFileSync(path.join(__dirname, "../", ".pem", "public_key.pem"),
  { encoding: "utf8", flag: "r" }
);

exports.authMiddleware = (req, res, next) => {
  const authorizationHeader = req.header("Authorization");
  let ignoredRoute = false;
  ignoredRoutes.forEach((route) => {
    if (req.path === route) ignoredRoute = true;
  });

  if (ignoredRoute) {
    next();
    return;
  }

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid authorization header", code: 401 });
  }
  const token = authorizationHeader.replace("Bearer ", "");
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Authorization token not found" });
  }
  try {
    req.user = jwt.verify(token, publicKey);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
