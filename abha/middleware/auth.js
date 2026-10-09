exports.authMiddleware = (req, res, next) => {
    const authorizationHeader = req.header("Authorization")
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid authorization header" });
    }
    const token = authorizationHeader.replace("Bearer ", "")
    if (!token) {
        return res
          .status(401)
          .json({ success: false, message: "Authorization token not found" });
    }
    try {
        req.token = token;
        next();
    } catch (err) {
     return res.status(401).json({ success: false, message: "Invalid token" });
    }
};


exports.xTokenMiddleware = (req, res, next) => {
  const authorizationHeader = req.header("X-TOKEN")
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid x token header" });
  }
  const token = authorizationHeader.replace("Bearer ", "")
  if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authorization token not found" });
  }
  try {
      req.xtoken = token;
      next();
  } catch (err) {
   return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
