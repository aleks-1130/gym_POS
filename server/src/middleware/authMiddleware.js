const prisma = require('../config/prisma');

const { verifyAnyToken } = require('../utils/authUtils');

// Middleware to verify Neon Auth Token
const authenticateToken = async (req, res, next) => {
    // Check cookies first, then fallback to Authorization header
    const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!token) return res.sendStatus(401);

    let email = null;
    let neonUserId = null;
    let decodedPayload = null;

    try {
        const verified = await verifyAnyToken(token);
        if (verified) {
            email = verified.email;
            decodedPayload = verified.payload;
            neonUserId = verified.payload?.sub;
            console.log('[DEBUG] Token verified for:', email);
        } else {
            throw new Error('Verification failed');
        }
    } catch (jwtError) {
        // 2. Fallback to Database Session Verification (if JWT verification failed or were expired)
        console.log('[DEBUG] JWT verification failed, trying DB Session lookup...');

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
                console.log('[DEBUG] DB Session Found:', session.email);
                email = session.email;
                neonUserId = session.userId;
            } else {
                console.log('[DEBUG] No valid session found in DB');
                throw new Error('Invalid session token');
            }
        } catch (dbError) {
            console.error('[DEBUG] DB Session lookup failed (DB likely down):', dbError.message);
            return res.status(503).json({ error: 'Database unavailable during session verification', details: dbError.message });
        }
    }

    if (!email) {
        return res.status(403).json({
            error: 'Authentication failed: email missing in token payload',
            tokenFound: !!token,
            lastVerificationError: 'email missing from decoded token',
            decodedPayload: decodedPayload || 'None'
        });
    }

    try {
        let userRole = null;
        let userId = null;
        let userName = null;
        let userTrainerId = null;
        let userSessionVersion = 0;
        const cacheService = require('../services/cacheService');
        const userCacheKey = `userLookup:${email.toLowerCase()}`;

        const cachedLookup = await cacheService.getOrSet(userCacheKey, async () => {
            const fetchedUser = await prisma.user.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } },
                select: { id: true, role: true, name: true, gymId: true, tenantId: true, trainerId: true, sessionVersion: true }
            });

            let fetchedMember = null;
            if (!fetchedUser) {
                fetchedMember = await prisma.member.findFirst({
                    where: { email: { equals: email, mode: 'insensitive' } },
                    select: { id: true, firstName: true, gymId: true, tenantId: true, sessionVersion: true }
                });
            }
            return { user: fetchedUser, member: fetchedMember };
        }, 30000); // 30 second TTL stops burst querying from frontend parallel fetches

        const { user, member } = cachedLookup || {};
        
        if (process.env.ENABLE_CACHE !== 'true') {
            console.log(user ? '[DEBUG] User Search Result:' : '[DEBUG] Member Search Result:', user || member);
        }

        if (user) {
            userId = user.id;
            userRole = user.role;
            userName = user.name;
            req.gymId = user.gymId || decodedPayload?.gymId || null;
            userTrainerId = user.trainerId;
            userSessionVersion = Number(user.sessionVersion || 0);
        } else if (member) {
            userId = member.id;
            userRole = 'MEMBER';
            userName = member.firstName;
            req.gymId = member.gymId || decodedPayload?.gymId || null;
            userSessionVersion = Number(member.sessionVersion || 0);
        }

        if (!userRole) {
            console.log('[DEBUG] User not found in local DB. Email:', email);
            return res.status(403).json({ error: 'User not found in system records', debugEmail: email });
        }

        const tokenSessionVersion = Number(decodedPayload?.sessionVersion ?? 0);
        if (!Number.isFinite(tokenSessionVersion) || tokenSessionVersion !== userSessionVersion) {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }

        // Attach user info to request
        req.user = {
            id: userId,
            email,
            role: userRole,
            name: userName,
            gymId: req.gymId,
            tenantId: user?.tenantId || member?.tenantId || decodedPayload?.tenantId || null,
            trainerId: userTrainerId,
            neonSub: neonUserId,
            sessionVersion: userSessionVersion
        };
        req.tenantId = req.user.tenantId;

        // Cross-gym access for OWNER and MEMBER via header override
        const gymHeader = req.headers['x-gym-id'];
        if (gymHeader && (userRole === 'OWNER' || userRole === 'MEMBER')) {
            const requestedGymId = Number(gymHeader);
            if (!Number.isNaN(requestedGymId)) {
                // VERIFY: The requested gym must belong to the user's tenant
                const targetGym = await prisma.gym.findFirst({
                    where: { id: requestedGymId, tenantId: req.user.tenantId },
                    select: { id: true }
                });
                if (targetGym) {
                    req.gymId = requestedGymId;
                    req.user.gymId = requestedGymId;
                } else {
                    console.warn(`[SECURITY] ${userRole} ${email} attempted to access gym ${requestedGymId} outside their tenant ${req.user.tenantId}`);
                    // Fallback to original gymId or reject? 
                    // Usually we just ignore the header if it's invalid for this tenant.
                }
            }
        }

        const { runWithContext } = require('../utils/context');
        runWithContext({ 
            gymId: req.gymId, 
            role: userRole, 
            tenantId: req.user.tenantId 
        }, () => {
            next();
        });
    } catch (err) {
        console.error('User sync failed:', err);
        const { isDatabaseUnreachableError } = require('../utils/prismaError');
        if (isDatabaseUnreachableError(err)) {
            return res.status(503).json({ error: 'Database unavailable during user details lookup' });
        }
        return res.sendStatus(500);
    }
};

const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user) return res.sendStatus(401);

        const userRole = String(req.user.role || '').toUpperCase();
        const normalizedRoles = roles.map((role) => String(role || '').toUpperCase());

        // Hierarchy Logic
        if (userRole === 'SUPERADMIN') return next(); // Superadmins pass everything
        if (normalizedRoles.includes('OWNER') && userRole === 'OWNER') return next();
        if (normalizedRoles.includes('ADMIN') && (userRole === 'ADMIN' || userRole === 'OWNER')) return next();
        if (normalizedRoles.includes('STAFF') && (userRole === 'STAFF' || userRole === 'ADMIN' || userRole === 'OWNER')) return next();

        // Exact match
        if (normalizedRoles.includes(userRole)) return next();

        console.log(`[DEBUG] Access denied for role: ${userRole}. Required roles: ${normalizedRoles.join(',')}`);
        return res.status(403).json({ error: 'Access denied' });
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
        return res.status(403).json({ error: 'Trainer account is not linked' });
    }

    if (!allowedRoles.has(role)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    return next();
};

module.exports = {
    authenticateToken,
    authorize,
    authorizeTrainerLinkedAccount
};

