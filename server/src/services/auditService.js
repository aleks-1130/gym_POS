const prisma = require('../config/prisma');

const logAudit = async (action, performedBy, target, details, gymId = null, tenantId = 1) => {
    try {
        await prisma.auditLog.create({
            data: { 
                action, 
                performedBy, 
                target, 
                details,
                gymId: gymId ? Number(gymId) : null,
                tenantId: tenantId ? Number(tenantId) : 1
             }
        });
    } catch (e) {
        console.error("Audit Log Error:", e);
    }
};

module.exports = { logAudit };
