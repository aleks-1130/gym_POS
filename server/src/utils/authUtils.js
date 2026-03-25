const prisma = require('../config/prisma');

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
                console.error('[AuthUtils] Invalid Neon JWKS URL:', error.message);
            }
        }
    }
    return { jwtVerify: _jose.jwtVerify, JWKS: _JWKS };
}

/**
 * Verifies a token (either local JWT or Neon Auth JWT)
 * @param {string} token 
 * @returns {Promise<{email: string, payload: any} | null>}
 */
async function verifyAnyToken(token) {
    if (!token) return null;

    // 1. Try Local JWT Verification first
    const jwt = require('jsonwebtoken');
    const SECRET = process.env.JWT_SECRET;
    try {
        const decoded = jwt.verify(token, SECRET);
        return { email: decoded.email, payload: decoded };
    } catch (localErr) {
        // Fallback to Neon
    }

    // 2. Try Neon Remote JWT Verification
    try {
        const { jwtVerify, JWKS } = await getJose();
        if (JWKS) {
            const { payload } = await jwtVerify(token, JWKS);
            return { email: payload.email, payload };
        }
    } catch (neonErr) {
        // Fallback to DB
    }

    // 3. Fallback to Database Session Verification
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
            return { email: session.email, payload: { sub: session.userId, email: session.email } };
        }
    } catch (dbError) {
        console.error('[AuthUtils] DB Session lookup failed:', dbError.message);
    }

    return null;
}

module.exports = { verifyAnyToken };
