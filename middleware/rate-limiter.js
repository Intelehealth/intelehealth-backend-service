// rate-limiter.js
const rateLimiter = require("express-rate-limit");
 
const limiter = rateLimiter({
    max: 5,
    windowMS: 10000, // 10 seconds
    message: {
        type: "error",
        message: "You can't make any more requests at the moment. Try again later"
    },
});
 
module.exports = limiter