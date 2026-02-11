const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const SECRET = process.env.JWT_SECRET;

const register = async (req, res) => {
    // Only for Staff/Admin registration for now
    const { email, password, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name },
            select: {
                id: true,
                email: true,
                name: true,
                role: true
            }
        });
        res.json({ message: "User created" });
    } catch (e) {
        res.status(400).json({ error: "Email usage already exists or error" });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    console.log("[DEBUG] Login Attempt:", email);
    console.log("[DEBUG] DATABASE_URL loaded:", !!process.env.DATABASE_URL);

    try {
        // 1. Try finding in USER table (Owner/Admin/Staff/Trainer)
        // Use select to avoid querying missing trainerId column
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true,
                name: true,
                role: true
                // Exclude trainerId
            }
        });
        console.log("[DEBUG] User Found:", !!user, user ? user.role : "N/A");

        if (user) {
            const match = await bcrypt.compare(password, user.password);
            console.log("[DEBUG] Password Match:", match);
            if (match) {
                // Ensure role is sent
                // trainerId is missing in DB, so set to null
                const token = jwt.sign({ id: user.id, role: user.role, type: 'USER', trainerId: null }, SECRET);
                return res.json({ token, user: { id: user.id, name: user.name, role: user.role, trainerId: null } });
            }
        }

        // 2. Try finding in MEMBER table
        const member = await prisma.member.findUnique({ where: { email } });
        console.log("[DEBUG] Member Found:", !!member);

        if (member && member.password) { // Only if password is set
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
        console.error("[DEBUG] Login Error:", e);
        res.status(500).json({ error: e.message });
    }
};

const setupMemberPassword = async (req, res) => {
    const { email, password } = req.body;
    try {
        const member = await prisma.member.findUnique({ where: { email } });
        if (!member) return res.status(404).json({ error: "Member not found" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.member.update({
            where: { email },
            data: { password: hashedPassword }
        });
        res.json({ message: "Password set successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = {
    register,
    login,
    setupMemberPassword
};
