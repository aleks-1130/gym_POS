const { createRemoteJWKSet, jwtVerify } = require('jose');
const prisma = require('../config/prisma');

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
const JWKS = createRemoteJWKSet(new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`));

// Middleware to verify Neon Auth Token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // Unauthorized

    let email = null;
    let neonUserId = null;

    try {
        // 1. Try JWT Verification (Stateless)
        const { payload } = await jwtVerify(token, JWKS);
        console.log("[DEBUG] JWT Verification Successful");
        email = payload.email;
        neonUserId = payload.sub;
    } catch (jwtError) {
        // 2. Fallback to Database Session Verification (Stateful for Opaque Tokens)
        console.log("[DEBUG] JWT Failed, trying DB Session lookup...");

        try {
            // Query neon_auth.session to find the token
            // We use $queryRaw because neon_auth schema might not be in the generated client text
            const sessionResults = await prisma.$queryRaw`
                SELECT s.*, u.email 
                FROM neon_auth.session s
                JOIN neon_auth.user u ON s."userId" = u.id
                WHERE s.token = ${token} AND s."expiresAt" > NOW()
                LIMIT 1
            `;

            if (sessionResults.length > 0) {
                const session = sessionResults[0];
                console.log("[DEBUG] DB Session Found:", session.email);
                email = session.email;
                neonUserId = session.userId;
            } else {
                console.log("[DEBUG] No valid session found in DB");
                throw new Error("Invalid session token");
            }
        } catch (dbError) {
            console.error("[DEBUG] DB Session lookup failed:", dbError);
            return res.sendStatus(403);
        }
    }

    if (!email) {
        return res.status(403).json({ error: "Invalid token structure or session expired" });
    }

    try {
        // Sync with local database to get Role
        // We concurrently check both tables as per existing logic
        let userRole = null;
        let userId = null;
        let userName = null;

        // 1. Check User (Admin/Staff/Owner/Trainer)
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, role: true, name: true }
        });
        console.log("[DEBUG] User Search Result:", user);

        if (user) {
            userId = user.id;
            userRole = user.role;
            userName = user.name;
        } else {
            // 2. Check Member
            const member = await prisma.member.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } },
                select: { id: true, firstName: true }
            });
            console.log("[DEBUG] Member Search Result:", member);

            if (member) {
                userId = member.id;
                userRole = 'MEMBER';
                userName = member.firstName;
            }
        }

        if (!userRole) {
            console.log("[DEBUG] User not found in local DB.");
            // User authenticated with Neon but not found in local DB
            // This could be a new signup that hasn't synced yet, or a mismatch
            return res.status(403).json({ error: "User not found in system records" });
        }

        // Attach user info to request
        req.user = {
            id: userId,
            email: email,
            role: userRole,
            name: userName,
            neonSub: neonUserId
        };

        next();
    } catch (err) {
        console.error("User sync failed:", err);
        return res.sendStatus(500);
    }
};

const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user) return res.sendStatus(401);

        const userRole = req.user.role;

        // Hierarchy Logic
        if (roles.includes("OWNER") && userRole === "OWNER") return next();
        if (roles.includes("ADMIN") && (userRole === "ADMIN" || userRole === "OWNER")) return next();
        if (roles.includes("STAFF") && (userRole === "STAFF" || userRole === "ADMIN" || userRole === "OWNER")) return next();

        // Exact match
        if (roles.includes(userRole)) return next();

        return res.status(403).json({ error: "Access denied" });
    };
};

module.exports = {
    authenticateToken,
    authorize
};
