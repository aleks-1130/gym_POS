const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { isDatabaseUnreachableError } = require('../../utils/prismaError');
const { syncToNeonAuth } = require('../../services/neonAuthSync');

const SECRET = process.env.JWT_SECRET;

const login = async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    console.log("[DEBUG] Login Attempt:", normalizedEmail);
    console.log("[DEBUG] DATABASE_URL loaded:", !!process.env.DATABASE_URL);

    try {
        // 1. Try finding in USER table (Owner/Admin/Staff/Trainer)
        // Use select to avoid querying missing trainerId column
        const user = await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            select: {
                id: true,
                email: true,
                password: true,
                name: true,
                role: true,
                trainerId: true
            }
        });

        if (user) {
            const match = await bcrypt.compare(password, user.password);
            console.log("[DEBUG] Password Match:", match);
            if (match) {
                const token = jwt.sign({ id: user.id, role: user.role, type: 'USER', trainerId: user.trainerId }, SECRET);
                return res.json({ token, user: { id: user.id, name: user.name, role: user.role, trainerId: user.trainerId } });
            }
        }

        // 2. Try finding in MEMBER table
        const member = await prisma.member.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
        });

        if (member && member.password) { // Only if password is set
            if (member.status === 'PENDING' || member.status === 'PENDING_ACTIVATION') {
                return res.status(403).json({ error: "Your account is pending activation. Please check your email." });
            }
            const match = await bcrypt.compare(password, member.password);
            console.log("[DEBUG] Member Password Match:", match);
            if (match) {
                const token = jwt.sign({ id: member.id, role: 'MEMBER', type: 'MEMBER' }, SECRET);
                return res.json({ token, user: { id: member.id, name: member.firstName, role: 'MEMBER' } });
            }
        }

        console.log("[DEBUG] Invalid Credentials");
        res.status(403).json({ error: "Invalid credentials" });
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
            await syncToNeonAuth(`${member.firstName} ${member.lastName}`, normalizedEmail, password);
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
    // req.user is already populated by the authenticateToken middleware
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(req.user);
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
            await syncToNeonAuth(fullName, account.email, password);
        } catch (syncErr) {
            console.error("Neon Auth Sync Warning:", syncErr.message);
        }

        res.json({ message: "Account activated successfully. You can now log in." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = {
    login,
    setupMemberPassword,
    getMe,
    verifyToken,
    activateAccount
};
