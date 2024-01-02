// rate-limiter.js
const rateLimiter = require("express-rate-limit");
 
/**
 * Rate limiter middleware function
 */
const limiter = rateLimiter({
    max: 20,
    windowMS: 10000, // 10 seconds
    message: {
        type: "error",
        message: "You can't make any more requests at the moment. Try again later"
    },
});
 
module.exports = limiter