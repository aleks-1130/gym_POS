const prisma = require('../config/prisma');
const axios = require('axios');

const rawNeonAuthUrl = process.env.NEON_AUTH_URL || process.env.NEON_AUTH_API_URL;
const NEON_AUTH_URL = rawNeonAuthUrl ? rawNeonAuthUrl.replace(/\/+$/, '') : null;

/**
 * Syncs a new user to Neon Auth by calling the sign-up endpoint.
 * This ensures the user exists in the auth system with the correct password.
 * 
 * @param {string} name - User's full name
 * @param {string} email - User's email
 * @param {string} password - User's raw password
 * @param {boolean} force - If true, deletes the user from Neon Auth before re-creating (useful for password resets)
 * @returns {Promise<boolean>} - True if successful or already exists, False if failed
 */
const syncToNeonAuth = async (name, email, password, force = false) => {
    if (!NEON_AUTH_URL) {
        console.warn("[NeonAuthSync] NEON_AUTH_URL is not defined. Skipping sync.");
        return false;
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();

    try {
        console.log(`[NeonAuthSync] Syncing ${normalizedEmail} to Neon Auth (force=${force})...`);

        if (force) {
            try {
                // Find user in neon_auth schema
                const neonUsers = await prisma.$queryRawUnsafe(
                    `SELECT id FROM neon_auth.user WHERE LOWER(email) = $1 LIMIT 1`,
                    normalizedEmail
                );

                if (neonUsers && neonUsers.length > 0) {
                    const userId = neonUsers[0].id;
                    console.log(`[NeonAuthSync] Found existing Neon user ${userId}. Deleting for re-sync...`);
                    
                    // Use direct raw SQL to reach into the neon_auth schema
        await prisma.$executeRaw`DELETE FROM neon_auth.session WHERE "userId" IN (SELECT id FROM neon_auth.user WHERE email = ${normalizedEmail})`;
        await prisma.$executeRaw`DELETE FROM neon_auth.account WHERE "userId" IN (SELECT id FROM neon_auth.user WHERE email = ${normalizedEmail})`;
        await prisma.$executeRaw`DELETE FROM neon_auth.user WHERE email = ${normalizedEmail}`;
                    
                    console.log(`[NeonAuthSync] Cleanup of ${normalizedEmail} in Neon Auth tables complete.`);
                }
            } catch (dbErr) {
                console.warn("[NeonAuthSync] Database cleanup warning (might not have permissions or tables missing):", dbErr.message);
                // We continue anyway, as the sign-up might still work or we might have partial success
            }
        }

        // Better Auth / Neon Auth "Email & Password" Sign Up Endpoint 
        // We use localhost origin to satisfy Better Auth security if it's running locally or behind a proxy that expects it
        const response = await axios.post(`${NEON_AUTH_URL}/sign-up/email`, {
            email: normalizedEmail,
            password,
            name
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:5173'
            },
            validateStatus: (status) => status < 500
        });

        if (response.status === 200 || response.status === 201) {
            console.log(`[NeonAuthSync] Successfully synced ${normalizedEmail}.`);
            return true;
        } else {
            const errorMsg = response.data?.message || response.data?.error || JSON.stringify(response.data);
            if (!force && errorMsg && (
                errorMsg.includes("already exists") ||
                errorMsg.includes("Unique constraint") ||
                String(response.status) === '422'
            )) {
                console.log(`[NeonAuthSync] User ${normalizedEmail} already exists in Neon Auth (Skipped).`);
                return true;
            }

            console.error(`[NeonAuthSync] Failed to sync ${normalizedEmail}. Status: ${response.status}. Msg: ${errorMsg}`);
            return false;
        }

    } catch (error) {
        console.error(`[NeonAuthSync] Exception syncing ${normalizedEmail}:`, error.message);
        return false;
    }
};

module.exports = { syncToNeonAuth };
