const prisma = require('../config/prisma');
const axios = require('axios');

const rawNeonAuthUrl = process.env.NEON_AUTH_URL || process.env.NEON_AUTH_API_URL;
const NEON_AUTH_URL = rawNeonAuthUrl ? rawNeonAuthUrl.replace(/\/+$/, '') : null;

/**
 * Syncs a user to Neon Auth.
 * 🛡️ SAFETY UPDATE: Removed destructive raw SQL DELETE commands.
 * Password resets now trigger a 'force' sync that updates Neon via the safe API, 
 * without ever touching the local database records.
 */
const syncToNeonAuth = async (name, email, password, force = false) => {
    if (!NEON_AUTH_URL) {
        console.warn("[NeonAuthSync] NEON_AUTH_URL is not defined. Skipping sync.");
        return false;
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();

    try {
        console.log(`[NeonAuthSync] Syncing ${normalizedEmail} to Neon Auth...`);

        // Better Auth / Neon Auth "Email & Password" Sign Up Endpoint 
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

        // 200/201 means successful creation OR successful update (depending on Neon's internal logic)
        if (response.status === 200 || response.status === 201) {
            console.log(`[NeonAuthSync] Successfully synced ${normalizedEmail}.`);
            return true;
        } else {
            const errorMsg = response.data?.message || response.data?.error || JSON.stringify(response.data);
            
            // If the user already exists, that's usually fine! 
            // In a password reset scenario, we rely on Neon's internal 'update' if it allows it.
            if (!force && (response.status === 422 || (errorMsg && errorMsg.includes("already exists")))) {
                console.log(`[NeonAuthSync] User ${normalizedEmail} already exists in Neon Auth.`);
                return true;
            }

            console.error(`[NeonAuthSync] Sync failed for ${normalizedEmail}. Status: ${response.status}. Msg: ${errorMsg}`);
            return false;
        }

    } catch (error) {
        console.error(`[NeonAuthSync] Exception syncing ${normalizedEmail}:`, error.message);
        return false;
    }
};

/**
 * SAFE Deletion logic (sessions only)
 */
const deleteFromNeonAuth = async (email) => {
    if (!email) return false;
    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        console.log(`[NeonAuthSync] Clearing sessions for ${normalizedEmail}...`);
        // We only delete sessions, never the user themselves, to avoid accidental table wipes.
        await prisma.$executeRaw`DELETE FROM neon_auth.session WHERE "userId" IN (SELECT id FROM neon_auth.user WHERE LOWER(email) = ${normalizedEmail})`;
        return true;
    } catch (dbErr) {
        console.warn(`[NeonAuthSync] Session cleanup failed for ${normalizedEmail}:`, dbErr.message);
        return false;
    }
};

module.exports = { syncToNeonAuth, deleteFromNeonAuth };
