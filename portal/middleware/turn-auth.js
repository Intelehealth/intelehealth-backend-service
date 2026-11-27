const crypto = require("crypto");
const { logStream } = require("../logger/index");

const turnAuthMiddleware = (req, res, next) => {
  const expected = process.env.TURN_API_SECRET;

  if (!expected) {
    logStream("error", "TURN_API_SECRET is not set", "Turn Auth");
    return res.status(503).json({
      status: false,
      message: "Turn API is not configured.",
    });
  }

  const a = Buffer.from(String(req.header("x-turn-secret") || ""));
  const b = Buffer.from(String(expected));

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    logStream(
      "error",
      `Turn auth failed from ip=${req.headers["cf-connecting-ip"] || req.ip} ua=${
        req.headers["user-agent"] || "?"
      }`,
      "Turn Auth"
    );
    return res.status(401).json({ status: false, message: "Unauthorized." });
  }

  return next();
};

module.exports = turnAuthMiddleware;
