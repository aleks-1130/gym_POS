const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { isDatabaseUnreachableError } = require('../utils/prismaError');

const SECRET = process.env.JWT_SECRET;

const register = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedName = String(name || '').trim();
        const rawPassword = String(password || '');

        if (!normalizedEmail || !rawPassword || !normalizedName) {
            return res.status(400).json({ error: "Name, email, and password are required" });
        }
        if (rawPassword.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }

        const [existingUser, existingMember] = await Promise.all([
            prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
            prisma.member.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
        ]);
        if (existingUser || existingMember) {
            return res.status(400).json({ error: "Email already in use" });
        }

        const parts = normalizedName.split(/\s+/).filter(Boolean);
        const firstName = parts.shift() || normalizedName;
        const lastName = parts.join(' ') || 'Member';
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        await prisma.member.create({
            data: {
                firstName,
                lastName,
                email: normalizedEmail,
                password: hashedPassword,
                status: 'PENDING'
            }
        });
        res.json({ message: "Account created. Wait for membership activation by staff." });
    } catch (e) {
        res.status(400).json({ error: "Registration failed" });
    }
};

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
        console.log("[DEBUG] User Found:", !!user, user ? user.role : "N/A");

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
        console.log("[DEBUG] Member Found:", !!member);

        if (member && member.password) { // Only if password is set
            if (member.status === 'PENDING') {
                return res.status(403).json({ error: "Your account is pending approval by staff." });
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

module.exports = {
    register,
    login,
    setupMemberPassword,
    getMe
};
