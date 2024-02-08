// rate-limiter.js
const rateLimiter = require("express-rate-limit");
 
/**
 * Rate limiter middleware function
 */
const limiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    message: {
        type: "error",
        message: "You can't make any more requests at the moment. Try again later"
    },
});
 
module.exports = limiter