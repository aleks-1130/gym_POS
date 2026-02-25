const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

// Get Audit Logs (Owner Only)
const getAuditLogs = async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};

// Manage Staff/Admins (List all users) - Owner/Admin view
const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });
        // Admins should maybe not see Owners? 
        // For simplicity, returning all, frontend filters actions.
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

// Promote/Demote/Transfer (Owner Only)
const changeUserRole = async (req, res) => {
    const { targetUserId, newRole } = req.body; // newRole: 'ADMIN' or 'STAFF'

    try {
        const target = await prisma.user.findUnique({ where: { id: Number(targetUserId) } });
        if (!target) return res.status(404).json({ error: "User not found" });

        if (newRole === 'OWNER') return res.status(400).json({ error: "Use transfer-ownership endpoint for Owner transfer" });
        if (target.role === 'OWNER') return res.status(403).json({ error: "Cannot change role of (self) Owner via this endpoint" });

        await prisma.user.update({
            where: { id: Number(targetUserId) },
            data: { role: newRole }
        });

        await logAudit("ROLE_CHANGE", req.user.email, target.email, `Changed role to ${newRole}`);
        res.json({ message: `User role updated to ${newRole}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Transfer Ownership
const transferOwnership = async (req, res) => {
    const { newOwnerId } = req.body;

    try {
        // Transaction: Demote current Owner -> ADMIN, Promote new User -> OWNER
        const currentOwnerId = req.user.id; // From token

        if (currentOwnerId === Number(newOwnerId)) return res.status(400).json({ error: "Already owner" });

        await prisma.$transaction([
            prisma.user.update({
                where: { id: currentOwnerId },
                data: { role: 'ADMIN' }
            }),
            prisma.user.update({
                where: { id: Number(newOwnerId) },
                data: { role: 'OWNER' }
            })
        ]);

        await logAudit("OWNERSHIP_TRANSFER", req.user.email, `User ID ${newOwnerId}`, "Transferred system ownership");
        res.json({ message: "Ownership transferred successfully. Please log in again." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Transfer failed" });
    }
};

module.exports = {
    getAuditLogs,
    getUsers,
    changeUserRole,
    transferOwnership
};
