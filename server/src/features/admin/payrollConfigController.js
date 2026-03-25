const prisma = require('../../config/prisma');

const getPayrollConfig = async (req, res) => {
    try {
        const gymId = req.gymId || req.user?.gymId;
        const tenantId = req.tenantId;
        if (!gymId) return res.status(400).json({ error: "Gym context required" });

        let config = await prisma.payrollConfig.findFirst({ 
            where: { 
                gymId: Number(gymId),
                tenantId: Number(tenantId)
            } 
        });
        if (!config) {
            // Create default if not exists
            config = await prisma.payrollConfig.create({
                data: {
                    gymId: Number(gymId),
                    tenantId: Number(tenantId),
                    classBasePay: 350.0,
                    classBonusPerStudent: 30.0,
                    classBonusThreshold: 5
                }
            });
        }
        res.json(config);
    } catch (error) {
        console.error("Get Payroll Config Error:", error);
        res.status(500).json({ error: "Failed to fetch payroll config" });
    }
};

const updatePayrollConfig = async (req, res) => {
    const { classBasePay, classBonusPerStudent, classBonusThreshold } = req.body;
    try {
        const gymId = req.gymId || req.user?.gymId;
        const tenantId = req.tenantId;
        if (!gymId) return res.status(400).json({ error: "Gym context required" });

        const existing = await prisma.payrollConfig.findFirst({
            where: { 
                gymId: Number(gymId),
                tenantId: Number(tenantId)
            }
        });

        let config;
        if (existing) {
            config = await prisma.payrollConfig.update({
                where: { id: existing.id },
                data: {
                    classBasePay: parseFloat(classBasePay),
                    classBonusPerStudent: parseFloat(classBonusPerStudent),
                    classBonusThreshold: parseInt(classBonusThreshold),
                    lastUpdatedBy: req.user.id,
                    tenantId: Number(tenantId)
                }
            });
        } else {
            config = await prisma.payrollConfig.create({
                data: {
                    gymId: Number(gymId),
                    tenantId: Number(tenantId),
                    classBasePay: parseFloat(classBasePay),
                    classBonusPerStudent: parseFloat(classBonusPerStudent),
                    classBonusThreshold: parseInt(classBonusThreshold),
                    lastUpdatedBy: req.user.id
                }
            });
        }
        res.json(config);
    } catch (error) {
        console.error("Update Payroll Config Error:", error);
        res.status(500).json({ error: "Failed to update payroll config" });
    }
};

module.exports = {
    getPayrollConfig,
    updatePayrollConfig
};
