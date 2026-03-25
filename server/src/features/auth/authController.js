const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { isDatabaseUnreachableError } = require('../../utils/prismaError');
const { syncToNeonAuth } = require('../../services/neonAuthSync');
const { verifyAnyToken } = require('../../utils/authUtils');

const SECRET = process.env.JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';

// Cross-domain (Vercel→Railway) requires sameSite:'none' + secure:true in production
const cookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
};

const login = async (req, res) => {
    const { email, password, neonToken } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    console.log("[DEBUG] Login Attempt:", normalizedEmail, "with neonToken:", !!neonToken);

    try {
        // 1. If neonToken is provided, verify it first
        let neonVerified = false;
        if (neonToken) {
            const verified = await verifyAnyToken(neonToken);
            if (verified && verified.email.toLowerCase() === normalizedEmail) {
                console.log("[DEBUG] Neon Token Verified for:", normalizedEmail);
                neonVerified = true;
            } else {
                console.warn("[DEBUG] Neon Token provided but verification failed or email mismatch.");
            }
        }

        // 2. Find in USER table (Owner/Admin/Staff/Trainer)
        const user = await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            select: {
                id: true, email: true, password: true, name: true, role: true,
                gymId: true, tenantId: true, trainerId: true, sessionVersion: true,
                status: true
            }
        });

        if (user) {
            if (user.status !== 'ACTIVE') {
                return res.status(403).json({ error: `Account is ${user.status.toLowerCase()}. Please contact support.` });
            }

            let match = neonVerified; // If Neon token is valid, we trust it
            if (!match && password) {
                match = await bcrypt.compare(password, user.password);
                
                // AUTO-SYNC: If we have a password and it matched Neon (neonVerified), 
                // we should NOT reach here. But if Neon succeeded (neonVerified=true) 
                // and we also have the raw password, we could technically verify local too.
            } else if (neonVerified && password) {
                // If Neon verified but we have a password, let's update our local hash if it was different
                const localMatch = await bcrypt.compare(password, user.password);
                if (!localMatch) {
                    console.log("[DEBUG] Syncing local password for USER:", normalizedEmail);
                    const newHash = await bcrypt.hash(password, 10);
                    await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
                }
            } else if (neonToken && neonVerified && !password) {
                // Neon token valid, no password provided (e.g. social login) - we trust Neon.
                match = true;
            }

            if (match) {
                const payload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    gymId: user.gymId,
                    tenantId: user.tenantId,
                    type: 'USER',
                    trainerId: user.trainerId,
                    sessionVersion: Number(user.sessionVersion || 0)
                };
                const token = jwt.sign(payload, SECRET);
                res.cookie('token', token, cookieOptions);
                
                const gym = user.gymId ? await prisma.gym.findUnique({
                    where: { id: user.gymId },
                    select: { id: true, name: true, currency: true, taxRate: true, companyId: true, address: true, phone: true }
                }) : null;

                return res.json({ 
                    user: { 
                        id: user.id, 
                        name: user.name, 
                        role: user.role, 
                        gymId: user.gymId, 
                        tenantId: user.tenantId,
                        trainerId: user.trainerId,
                        gym
                    } 
                });
            }
        }

        // 3. Try finding in MEMBER table
        const member = await prisma.member.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            select: {
                id: true, email: true, password: true, status: true,
                gymId: true, firstName: true, sessionVersion: true
            }
        });

        if (member) {
            if (member.status === 'PENDING' || member.status === 'PENDING_ACTIVATION') {
                return res.status(403).json({ error: "Your account is pending activation. Please check your email." });
            }
            if (member.status === 'DELETED') {
                return res.status(403).json({ error: "This account has been closed." });
            }

            let match = neonVerified;
            if (!match && password && member.password) {
                match = await bcrypt.compare(password, member.password);
            } else if (neonVerified && password && member.password) {
                const localMatch = await bcrypt.compare(password, member.password);
                if (!localMatch) {
                    console.log("[DEBUG] Syncing local password for MEMBER:", normalizedEmail);
                    const newHash = await bcrypt.hash(password, 10);
                    await prisma.member.update({ where: { id: member.id }, data: { password: newHash } });
                }
            } else if (neonToken && neonVerified && !password) {
                match = true;
            }

            if (match) {
                const payload = {
                    id: member.id,
                    email: member.email,
                    role: 'MEMBER',
                    gymId: member.gymId,
                    type: 'MEMBER',
                    sessionVersion: Number(member.sessionVersion || 0)
                };
                const token = jwt.sign(payload, SECRET);
                res.cookie('token', token, cookieOptions);
                
                const gym = member.gymId ? await prisma.gym.findUnique({
                    where: { id: member.gymId },
                    select: { id: true, name: true, currency: true, taxRate: true, companyId: true, address: true, phone: true }
                }) : null;

                return res.json({ 
                    user: { 
                        id: member.id, 
                        name: member.firstName, 
                        role: 'MEMBER', 
                        gymId: member.gymId,
                        gym
                    } 
                });
            }
        }

        console.log("[DEBUG] Invalid Credentials for:", normalizedEmail);
        res.status(403).json({ error: "Invalid email or password" });
    } catch (e) {
        if (isDatabaseUnreachableError(e)) {
            console.error("[DEBUG] Login Error: database unreachable");
            return res.status(503).json({ error: "Database unavailable. Please try again shortly." });
        }
        console.error("[DEBUG] Login Error:", e);
        res.status(500).json({ error: e.message });
    }
};

const setupMemberPassword = async (req, res) => {
    const { email, password } = req.body;
    try {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const member = await prisma.member.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
        });
        if (!member) return res.status(404).json({ error: "Member not found" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.member.update({
            where: { id: member.id },
            data: { password: hashedPassword }
        });

        // Sync to Neon Auth (Dual Write)
        // Check if syncToNeonAuth is imported. It is likely not, so we need to add it or fix imports.
        // Wait, I need to check imports in authController.js first.
        try {
            await syncToNeonAuth(`${member.firstName} ${member.lastName}`, normalizedEmail, password, true);
        } catch (syncErr) {
            console.error("Neon Auth Sync Warning:", syncErr.message);
            // Don't fail the request, just warn
        }

        res.json({ message: "Password set successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const getMe = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const gym = req.user.gymId ? await prisma.gym.findUnique({
        where: { id: req.user.gymId },
        select: { id: true, name: true, currency: true, taxRate: true, companyId: true, address: true, phone: true }
    }) : null;

    res.json({ ...req.user, gym });
};

const verifyToken = async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ error: "Token is required" });
    }

    try {
        let account = await prisma.member.findUnique({ where: { activationToken: token } });
        let isMember = true;

        if (!account) {
            account = await prisma.user.findUnique({ where: { activationToken: token } });
            isMember = false;
        }

        if (!account) {
            return res.status(400).json({
                error: "Invalid or consumed token",
                code: "TOKEN_INVALID_OR_CONSUMED",
                message: "This activation link is invalid. If you have already set your password, your account is already activated and you may proceed to login."
            });
        }

        if (account.status === 'ACTIVE') {
            return res.status(400).json({
                error: "Account already activated",
                code: "ALREADY_ACTIVATED",
                message: "This account has already been activated. Please proceed to the login page."
            });
        }

        if (account.activationExpires && new Date() > new Date(account.activationExpires)) {
            return res.status(400).json({ error: "Activation token has expired", code: "TOKEN_EXPIRED" });
        }

        const name = isMember ? account.firstName : account.name;
        const role = isMember ? 'MEMBER' : account.role;
        res.json({ message: "Token is valid", memberName: name, role });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const activateAccount = async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
    }

    try {
        let account = await prisma.member.findUnique({ where: { activationToken: token } });
        let isMember = true;

        if (!account) {
            account = await prisma.user.findUnique({ where: { activationToken: token } });
            isMember = false;
        }

        if (!account) {
            return res.status(400).json({ error: "Invalid or expired activation token" });
        }

        if (account.activationExpires && new Date() > new Date(account.activationExpires)) {
            return res.status(400).json({ error: "Activation token has expired" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        if (isMember) {
            await prisma.member.update({
                where: { id: account.id },
                data: {
                    password: hashedPassword,
                    status: 'ACTIVE',
                    activationToken: null,
                    activationExpires: null
                }
            });
        } else {
            await prisma.user.update({
                where: { id: account.id },
                data: {
                    password: hashedPassword,
                    status: 'ACTIVE',
                    activationToken: null,
                    activationExpires: null
                }
            });
        }

        // Sync to Neon Auth
        try {
            const fullName = isMember ? `${account.firstName} ${account.lastName}` : account.name;
            await syncToNeonAuth(fullName, account.email, password, true);
        } catch (syncErr) {
            console.error("Neon Auth Sync Warning:", syncErr.message);
        }

        res.json({ message: "Account activated successfully. You can now log in." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../../services/emailService');

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        // Find in User or Member
        let account = await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } });
        let isMember = false;

        if (!account) {
            account = await prisma.member.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } });
            isMember = true;
        }

        // We return a generic message even if not found to prevent email enumeration
        if (!account) {
            console.log(`[ForgotPassword] Request for unknown email: ${normalizedEmail}`);
            return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
        }

        // Generate a secure raw token and a hash
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save hash to DB
        if (isMember) {
            await prisma.member.update({
                where: { id: account.id },
                data: { resetPasswordToken: hashedToken, resetPasswordExpires: expiration }
            });
        } else {
            await prisma.user.update({
                where: { id: account.id },
                data: { resetPasswordToken: hashedToken, resetPasswordExpires: expiration }
            });
        }

        // Send email with the RAW token
        const fullName = isMember ? `${account.firstName} ${account.lastName}` : account.name;
        await sendPasswordResetEmail(account.email, fullName, rawToken);

        res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (e) {
        console.error("[ForgotPassword] Error:", e.message);
        res.status(500).json({ error: "Failed to process password reset request." });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
    }

    try {
        // Hash the incoming token to look it up in the database
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        let account = await prisma.user.findFirst({ where: { resetPasswordToken: hashedToken } });
        let isMember = false;

        if (!account) {
            account = await prisma.member.findFirst({ where: { resetPasswordToken: hashedToken } });
            isMember = true;
        }

        if (!account) {
            return res.status(400).json({ error: "Invalid or expired password reset token" });
        }

        if (account.resetPasswordExpires && new Date() > new Date(account.resetPasswordExpires)) {
            return res.status(400).json({ error: "Password reset token has expired" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        if (isMember) {
            await prisma.member.update({
                where: { id: account.id },
                data: {
                    password: hashedPassword,
                    resetPasswordToken: null,
                    resetPasswordExpires: null
                }
            });
        } else {
            await prisma.user.update({
                where: { id: account.id },
                data: {
                    password: hashedPassword,
                    resetPasswordToken: null,
                    resetPasswordExpires: null
                }
            });
        }

        // Sync to Neon Auth
        try {
            const fullName = isMember ? `${account.firstName} ${account.lastName}` : account.name;
            await syncToNeonAuth(fullName, account.email, newPassword, true);
        } catch (syncErr) {
            console.error("Neon Auth Sync Warning:", syncErr.message);
        }

        res.json({ message: "Password has been successfully reset. You can now log in." });
    } catch (e) {
        console.error("[ResetPassword] Error:", e.message);
        res.status(500).json({ error: "Failed to reset password." });
    }
};


const logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: IS_PROD ? 'none' : 'lax'
    });
    res.json({ message: "Logged out successfully" });
};

const logoutAllSessions = async (req, res) => {
    if (!req.user?.id || !req.user?.role) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const role = String(req.user.role || '').toUpperCase();

    try {
        if (role === 'MEMBER') {
            await prisma.member.update({
                where: { id: Number(req.user.id) },
                data: { sessionVersion: { increment: 1 } }
            });
        } else {
            await prisma.user.update({
                where: { id: Number(req.user.id) },
                data: { sessionVersion: { increment: 1 } }
            });
        }

        // Best effort: clear Neon-auth sessions tied to this email as well.
        if (req.user?.email) {
            try {
                await prisma.$executeRaw`
                    DELETE FROM neon_auth.session
                    WHERE "userId" IN (
                        SELECT id
                        FROM neon_auth.user
                        WHERE LOWER(email) = LOWER(${String(req.user.email)})
                    )
                `;
            } catch (sessionErr) {
                console.warn("[logout-all] Failed to clear Neon sessions:", sessionErr.message);
            }
        }

        res.clearCookie('token', {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: IS_PROD ? 'none' : 'lax'
        });

        return res.json({ message: "Signed out from all sessions" });
    } catch (e) {
        if (isDatabaseUnreachableError(e)) {
            return res.status(503).json({ error: "Database unavailable. Please try again shortly." });
        }
        return res.status(500).json({ error: e.message || "Failed to sign out all sessions" });
    }
};

module.exports = {
    login,
    logout,
    logoutAllSessions,
    setupMemberPassword,
    getMe,
    verifyToken,
    activateAccount,
    forgotPassword,
    resetPassword
};
