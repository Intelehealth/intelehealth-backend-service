const jwt = require("jsonwebtoken");
const ignoredRoutes = require("../IGNORED_ROUTES");
const fs = require('fs');
const path = require('path');
const privateKEY  = fs.readFileSync(path.join(__dirname, './../', '.pem', 'private_key.pem'), 
  { encoding: 'utf8', flag: 'r' }
)



module.exports = (function () {
  const JWT_SECRET = process.env.JWT_SECRET;
  
  this.decodeTokenAndGetUser = async (token) => {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  };

  this.authMiddleware = async (req, res, next) => {
    const token = req.header("authorization");
    let ignoredRoute = false;
    ignoredRoutes.forEach((route) => {
      if (req.path === route) {
        ignoredRoute = true;
      }
    });

    if (ignoredRoute) {
      next();
      return;
    }
    if (!token) {
      res.statusCode = 401;
      res.json({ success: false, message: "Please login!" });
      return;
    }
    try {
      const data = await this.decodeTokenAndGetUser(token);

      if (!data) {
        res.json({ success: false, message: "Please login again!" }, 401);
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  this.getToken = (data, expiresIn = "15 days") => {
    return jwt.sign(
      {
        exp: expiresIn,
        data,
      },
      privateKEY,
      {
        algorithm: "RS256",
      }
    );
  };

  return this;
})();
