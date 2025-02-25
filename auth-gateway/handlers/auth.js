const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const ignoredRoutes = require('../IGNORED_ROUTES');
const publicKey  = fs.readFileSync(path.join(__dirname, '../', '.pem', 'public_key.pem'), 
{ encoding: 'utf8', flag: 'r' }
)

const { black_list_tokens } = require('../models');
const { logStream } = require("../logger/index");

const authMiddleware = async (req, res, next) => {
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
    const token = authorizationHeader.replace("Bearer ", "")
    if (!token) {
        return res
          .status(401)
          .json({ success: false, message: "Authorization token not found" });
    }
    try {
        const decoded = jwt.verify(token, publicKey);

        // // Check if the token is blacklisted
        const blacklistedToken = await black_list_tokens.findOne({ where: { userId: decoded.data.userId } });
        if (blacklistedToken) {
          logStream("warn", `Attempted login with blacklisted token for userId ${decoded.data.userId}`, "Login");
          return res.status(403).json({ message: "Token is blacklisted. Access denied." });
        }

        req.user = decoded;
        next();
    } catch (err) {
     return res.status(401).json({ success: false, message: "Invalid token" });
    }
};

module.exports = authMiddleware;