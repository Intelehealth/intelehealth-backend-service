const morgan = require("morgan");
const logger = require("../utils/logger");

const stream = {
  // Use the http severity
  write: (message) => logger.http(message),
};

// const skip = () => {
//   const env = process.env.NODE_ENV || "dev";
//   return env !== "dev";
// };

const morganMiddleware = morgan("dev",{ stream });

module.exports = morganMiddleware;