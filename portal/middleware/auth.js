import jwt from "jsonwebtoken";
const fs = require('fs');
const path = require('path');
const publicKey  = fs.readFileSync(path.join(__dirname, './../../', '.pem', 'public_key.pem'), 
  { encoding: 'utf8', flag: 'r' }
)

const authMiddleware = (req, res, next) => {
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
        const decoded = jwt.verify(token, publicKey);
        (req as any).user = decoded;
        next();
    } catch (err) {
     return res.status(401).json({ success: false, message: "Invalid token" });
    }
};
export default authMiddleware;