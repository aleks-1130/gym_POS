const rateLimit = require('express-rate-limit');

// Applied only to authentication endpoints to prevent brute-force attacks.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        error: "Too many authentication attempts, please try again after 15 minutes",
        status: 429
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter
};
