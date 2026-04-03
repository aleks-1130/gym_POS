const prisma = require('../config/prisma');
const axios = require('axios');

const rawNeonAuthUrl = process.env.NEON_AUTH_URL || process.env.NEON_AUTH_API_URL;
const NEON_AUTH_URL = rawNeonAuthUrl ? rawNeonAuthUrl.replace(/\/+$/, '') : null;

/**
 * Syncs a user to Neon Auth.
 * 🚀 UPDATE: Re-enabled safe 'force' sync for password resets.
 */
const syncToNeonAuth = async (name, email, password, force = false) => {
    if (!NEON_AUTH_URL) {
        console.warn("[NeonAuthSync] NEON_AUTH_URL is not defined. Skipping sync.");
        return false;
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();

    try {
        if (force) {
            console.log(`[NeonAuthSync] Force-syncing ${normalizedEmail}. Clearing old login record...`);
            await deleteFromNeonAuth(normalizedEmail, true);
        }

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

        if (response.status === 200 || response.status === 201) {
            console.log(`[NeonAuthSync] Successfully synced ${normalizedEmail}.`);
            return true;
        } else {
            const errorMsg = response.data?.message || response.data?.error || JSON.stringify(response.data);
            
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
 * SAFE Deletion logic (sessions only by default, can obliterate user for sync)
 * 🛡️ Prefixing EVERY table with 'neon_auth.' to prevent local data loss.
 */
const deleteFromNeonAuth = async (email, obliterateUser = false) => {
    if (!email) return false;
    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        console.log(`[NeonAuthSync] Clearing sync data for ${normalizedEmail} (user=${obliterateUser})...`);
        
        // 1. Delete Sessions
        await prisma.$executeRaw`DELETE FROM neon_auth.session WHERE "userId" IN (SELECT id FROM neon_auth.user WHERE LOWER(email) = ${normalizedEmail})`;
        
        if (obliterateUser) {
            // 2. Delete linked accounts
            await prisma.$executeRaw`DELETE FROM neon_auth.account WHERE "userId" IN (SELECT id FROM neon_auth.user WHERE LOWER(email) = ${normalizedEmail})`;
            // 3. Delete the user record in neon_auth ONLY
            await prisma.$executeRaw`DELETE FROM neon_auth.user WHERE LOWER(email) = ${normalizedEmail}`;
        }
        
        return true;
    } catch (dbErr) {
        console.warn(`[NeonAuthSync] Sync cleanup failed for ${normalizedEmail}:`, dbErr.message);
        if (dbErr.message.includes("permission denied")) {
            console.error(" ⚠️  DATABASE PERMISSION ERROR: Please run GRANT ALL ON SCHEMA neon_auth TO neondb_owner; in your Neon console!");
        }
        return false;
    }
};

module.exports = { syncToNeonAuth, deleteFromNeonAuth };
