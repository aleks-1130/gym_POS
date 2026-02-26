const prisma = require('../../config/prisma');

const getPayrollConfig = async (req, res) => {
    try {
        let config = await prisma.payrollConfig.findUnique({ where: { id: 1 } });
        if (!config) {
            // Create default if not exists
            config = await prisma.payrollConfig.create({
                data: {
                    id: 1,
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
        const config = await prisma.payrollConfig.upsert({
            where: { id: 1 },
            update: {
                classBasePay: parseFloat(classBasePay),
                classBonusPerStudent: parseFloat(classBonusPerStudent),
                classBonusThreshold: parseInt(classBonusThreshold),
                lastUpdatedBy: req.user.id
            },
            create: {
                id: 1,
                classBasePay: parseFloat(classBasePay),
                classBonusPerStudent: parseFloat(classBonusPerStudent),
                classBonusThreshold: parseInt(classBonusThreshold),
                lastUpdatedBy: req.user.id
            }
        });
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
