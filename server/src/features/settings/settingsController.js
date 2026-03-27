const prisma = require('../../config/prisma');
const { isDatabaseUnreachableError } = require('../../utils/prismaError');

const getSettings = async (req, res) => {
    const gymId = req.gymId;
    if (!gymId) return res.status(400).json({ error: "Gym context missing" });

    try {
        const gym = await prisma.gym.findFirst({
            where: { id: gymId, tenantId: req.user.tenantId }
        });
        
        if (!gym) {
            return res.status(404).json({ error: 'Gym not found' });
        }
        res.json(gym);
    } catch (error) {
        if (isDatabaseUnreachableError(error)) {
            console.error('Error fetching settings: database unreachable');
            return res.status(503).json({ error: 'Database unavailable. Please try again shortly.' });
        }
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

const updateSettings = async (req, res) => {
    const gymId = req.gymId;
    if (!gymId) return res.status(400).json({ error: "Gym context missing" });

    try {
        const { 
            name, address, phone, email, website, 
            currency, taxRate, roundingRule, referencePrefix, companyId 
        } = req.body;

        await prisma.gym.updateMany({
            where: { id: gymId, tenantId: req.user.tenantId },
            data: { 
                name, address, phone, email, website,
                currency, 
                taxRate: taxRate !== undefined ? Number(taxRate) : undefined,
                roundingRule, 
                referencePrefix, 
                companyId 
            }
        });

        const updatedGym = await prisma.gym.findUnique({
            where: { id: gymId }
        });

        res.json(updatedGym);
    } catch (error) {
        if (isDatabaseUnreachableError(error)) {
            console.error('Error updating settings: database unreachable');
            return res.status(503).json({ error: 'Database unavailable. Please try again shortly.' });
        }
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

module.exports = { getSettings, updateSettings };
