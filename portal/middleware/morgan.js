const morgan = require("morgan");
var fs = require('fs')
var path = require('path')

// const stream = {
//   // Use the http severity
//   write: (message) => logger.http(message),
// };

// const skip = () => {
//   const env = process.env.NODE_ENV || "dev";
//   return env !== "dev";
// };

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
 
const morganMiddleware = morgan("dev",{ stream: accessLogStream });

module.exports = morganMiddleware;