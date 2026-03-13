const prisma = require('../config/prisma');

// jose is ESM-only, so we use a lazy dynamic import
let _jose = null;
let _JWKS = null;

// Handle different env variable names and trailing slashes
const rawNeonAuthUrl = process.env.NEON_AUTH_URL || process.env.NEON_AUTH_API_URL;
const NEON_AUTH_URL = rawNeonAuthUrl ? rawNeonAuthUrl.replace(/\/+$/, '') : null;
const NEON_AUTH_JWKS_URL = process.env.NEON_AUTH_JWKS_URL || (NEON_AUTH_URL ? `${NEON_AUTH_URL}/.well-known/jwks.json` : null);

async function getJose() {
    if (!_jose) {
        _jose = await import('jose');

        if (NEON_AUTH_JWKS_URL) {
            try {
                _JWKS = _jose.createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));
            } catch (error) {
                console.error("[DEBUG] Invalid Neon JWKS URL, JWT verification disabled:", error.message);
            }
        }
    }
    return { jwtVerify: _jose.jwtVerify, JWKS: _JWKS };
}

// Middleware to verify Neon Auth Token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    let email = null;
    let neonUserId = null;

    try {
        // 1. Try JWT Verification (Stateless)
        const { jwtVerify, JWKS } = await getJose();

        if (JWKS) {
            const { payload } = await jwtVerify(token, JWKS);
            console.log("[DEBUG] JWT Verification Successful");
            email = payload.email;
            neonUserId = payload.sub;
        } else {
            throw new Error("JWT verification unavailable (missing NEON_AUTH_URL)");
        }
    } catch (jwtError) {
        // 2. Fallback to Database Session Verification
        console.log("[DEBUG] JWT skipped/failed, trying DB Session lookup...");

        try {
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
            console.log("[DEBUG] Returning 403 because DB lookup failed");
            return res.sendStatus(403);
        }
    }

    if (!email) {
        console.log("[DEBUG] Returning 403 because email is null");
        return res.status(403).json({ error: "Invalid token structure or session expired" });
    }

    try {
        let userRole = null;
        let userId = null;
        let userName = null;
        let userTrainerId = null;

        // 1. Check User (Admin/Staff/Owner/Trainer)
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, role: true, name: true, trainerId: true }
        });
        console.log("[DEBUG] User Search Result:", user);

        if (user) {
            userId = user.id;
            userRole = user.role;
            userName = user.name;
            userTrainerId = user.trainerId;
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
            console.log("[DEBUG] User not found in local DB. Email:", email);
            return res.status(403).json({ error: "User not found in system records" });
        }

        // Attach user info to request
        req.user = {
            id: userId,
            email: email,
            role: userRole, // ← Fixed: removed duplicate
            name: userName,
            trainerId: userTrainerId,
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

        console.log(`[DEBUG] Access denied for role: ${userRole}. Required roles: ${roles.join(',')}`);
        return res.status(403).json({ error: "Access denied" });
    };
};

// Backward-compatible guard for trainer self-service routes.
// Some legacy trainer-linked accounts may carry STAFF/ADMIN role while still mapped to a trainerId.
const authorizeTrainerLinkedAccount = (req, res, next) => {
    if (!req.user) return res.sendStatus(401);

    const role = String(req.user.role || '').toUpperCase();
    const trainerId = Number(req.user.trainerId);
    const isTrainerLinked = Number.isInteger(trainerId) && trainerId > 0;
    const allowedRoles = new Set(['TRAINER', 'STAFF', 'ADMIN', 'OWNER']);

    if (!isTrainerLinked) {
        return res.status(403).json({ error: "Trainer account is not linked" });
    }

    if (!allowedRoles.has(role)) {
        return res.status(403).json({ error: "Access denied" });
    }

    return next();
};

module.exports = {
    authenticateToken,
    authorize,
    authorizeTrainerLinkedAccount
};
