const prisma = require('../config/prisma');
const logAudit = require('../services/auditService');

// Check-in (Manual/Kiosk)
const checkIn = async (req, res) => {
    const { memberId, status } = req.body;
    try {
        const log = await prisma.accessLog.create({
            data: {
                memberId: parseInt(memberId),
                status: status || 'ALLOWED', // ALLOWED, DENIED
                checkIn: new Date()
            }
        });

        // Update member usage stats if needed?
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: "Check-in failed" });
    }
};

const getAccessLogs = async (req, res) => {
    try {
        const { date } = req.query;
        let where = {};
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            where.checkIn = { gte: start, lte: end };
        }

        const logs = await prisma.accessLog.findMany({
            where,
            include: { member: true },
            orderBy: { checkIn: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};

const getTrafficStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const logs = await prisma.accessLog.findMany({
            where: { checkIn: { gte: today } }
        });

        const hourly = new Array(24).fill(0);
        logs.forEach(log => {
            const hour = new Date(log.checkIn).getHours();
            hourly[hour]++;
        });

        res.json({
            todayTotal: logs.length,
            hourly
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch traffic" });
    }
};

const getAccessLogDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const log = await prisma.accessLog.findUnique({
            where: { id: Number(id) },
            include: { member: true }
        });
        if (!log) return res.status(404).json({ error: "Log not found" });
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};


// Simulation Route (Dev/Demo only)
const simulateAccess = async (req, res) => {
    try {
        const { type } = req.body; // 'valid', 'expired', 'denied'

        // Find a random member fitting the criteria
        let member;
        if (type === 'valid') {
            member = await prisma.member.findFirst({ where: { status: 'ACTIVE' } });
        } else if (type === 'expired') {
            member = await prisma.member.findFirst({ where: { status: 'EXPIRED' } });
        }

        if (!member) {
            // Fallback to any member
            member = await prisma.member.findFirst();
        }

        if (!member) return res.status(404).json({ error: "No members found to simulate" });

        const status = (type === 'valid' && member.status === 'ACTIVE') ? 'ALLOWED' : 'DENIED';

        const log = await prisma.accessLog.create({
            data: {
                memberId: member.id,
                status,
                checkIn: new Date()
            },
            include: { member: true }
        });

        res.json(log);
    } catch (e) {
        res.status(500).json({ error: "Simulation failed" });
    }
};

module.exports = {
    checkIn,
    getAccessLogs,
    getTrafficStats,
    getAccessLogDetails,
    simulateAccess
};
