const prisma = require('../config/prisma');

const logAudit = async (action, performedBy, target, details) => {
    try {
        await prisma.auditLog.create({
            data: { action, performedBy, target, details }
        });
    } catch (e) {
        console.error("Audit Log Error:", e);
    }
};

module.exports = { logAudit };
