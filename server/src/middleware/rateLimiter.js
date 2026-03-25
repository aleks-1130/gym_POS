const rateLimit = require('express-rate-limit');

// 1. Global Rate Limiter
// Applied to all routes to prevent general DoS attacks.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per 15 minutes (increased for SPA testing)
    message: {
        error: "Too many requests from this IP, please try again after 15 minutes",
        status: 429
    },
    standardHeaders: true, 
    legacyHeaders: false,
});

// 2. Auth Rate Limiter
// Applied strictly to login and signup routes to prevent brute-force attacks.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased from 10 to 100 to support AuthContext checks
    message: {
        error: "Too many authentication attempts, please try again after 15 minutes",
        status: 429
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    globalLimiter,
    authLimiter
};
