const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || "supersecretkey";

// Middleware to verify Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authenticateTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, SECRET, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};

// Middleware for Role Checking
// Middleware for Role Checking (Strict)
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    // Hierarchy: OWNER > ADMIN > STAFF

    return (req, res, next) => {
        if (!req.user) return res.sendStatus(401);

        const userRole = req.user.role; // OWNER, ADMIN, STAFF

        if (roles.includes("OWNER") && userRole === "OWNER") return next();
        if (roles.includes("ADMIN") && (userRole === "ADMIN" || userRole === "OWNER")) return next();
        if (roles.includes("STAFF") && (userRole === "STAFF" || userRole === "ADMIN" || userRole === "OWNER")) return next();

        // Exact match fallback
        if (roles.includes(userRole)) return next();

        return res.status(403).json({ error: "Access denied" });
    };
};

module.exports = {
    authenticateToken,
    authenticateTokenOptional,
    authorize
};
