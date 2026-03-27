const prisma = require('../../config/prisma');

const getFinancialInstitutions = async (req, res) => {
    try {
        const gymId = req.user.gymId || req.gymId;
        const institutions = await prisma.financialInstitution.findMany({
            where: { 
                gymId: Number(gymId),
                tenantId: Number(req.user.tenantId)
            }
        });
        res.json(institutions);
    } catch (error) {
        console.error('Error fetching financial institutions:', error);
        res.status(500).json({ error: 'Failed to fetch financial institutions' });
    }
};

const updateFinancialInstitutions = async (req, res) => {
    const { institutions } = req.body; // Array of { method, financialInstitutionId, label, isActive }

    try {
        // Simple implementation: delete and recreate or upsert
        // For multi-tenancy safety, we only touch institutions for this gymId
        const gymId = req.user.gymId || req.gymId;

        // Using a transaction to ensure atomic update
        await prisma.$transaction(async (tx) => {
            // Delete existing ones
            await tx.financialInstitution.deleteMany({
                where: { 
                    gymId,
                    tenantId: Number(req.user.tenantId)
                }
            });

            // Create new ones
            if (institutions && institutions.length > 0) {
                await tx.financialInstitution.createMany({
                    data: institutions.map(inst => ({
                        gymId,
                        method: inst.method,
                        financialInstitutionId: inst.financialInstitutionId,
                        label: inst.label,
                        isActive: inst.isActive !== undefined ? inst.isActive : true,
                        tenantId: Number(req.user.tenantId)
                    }))
                });
            }
        });

        const updated = await prisma.financialInstitution.findMany({
            where: { 
                gymId,
                tenantId: Number(req.user.tenantId)
            }
        });
        res.json(updated);
    } catch (error) {
        console.error('Error updating financial institutions:', error);
        res.status(500).json({ error: 'Failed to update financial institutions' });
    }
};

module.exports = {
    getFinancialInstitutions,
    updateFinancialInstitutions
};
