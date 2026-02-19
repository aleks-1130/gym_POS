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
 * @returns {Promise<boolean>} - True if successful or already exists, False if failed
 */
const syncToNeonAuth = async (name, email, password) => {
    if (!NEON_AUTH_URL) {
        console.warn("[NeonAuthSync] NEON_AUTH_URL is not defined. Skipping sync.");
        return false;
    }

    try {
        console.log(`[NeonAuthSync] Syncing ${email} to Neon Auth...`);

        // Better Auth / Neon Auth "Email & Password" Sign Up Endpoint
        // Typically /sign-up/email
        const response = await axios.post(`${NEON_AUTH_URL}/sign-up/email`, {
            email,
            password,
            name
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:5173' // Required by Better Auth / Neon Auth for security checks
            },
            validateStatus: (status) => status < 500 // Resolve even on 400s (like "user exists")
        });

        if (response.status === 200 || response.status === 201) {
            console.log(`[NeonAuthSync] Successfully synced ${email}.`);
            return true;
        } else {
            // Check for specific "User already exists" errors to avoid false alarms
            const errorMsg = response.data?.message || response.data?.error || JSON.stringify(response.data);
            if (errorMsg && (
                errorMsg.includes("already exists") ||
                errorMsg.includes("Unique constraint") ||
                String(response.status) === '422' // Validation error often means duplicate
            )) {
                console.log(`[NeonAuthSync] User ${email} already exists in Neon Auth (Skipped).`);
                return true;
            }

            console.error(`[NeonAuthSync] Failed to sync ${email}. Status: ${response.status}. Msg: ${errorMsg}`);
            return false;
        }

    } catch (error) {
        console.error(`[NeonAuthSync] Exception syncing ${email}:`, error.message);
        if (error.response) {
            console.error("Response Data:", error.response.data);
        }
        return false;
    }
};

module.exports = { syncToNeonAuth };
