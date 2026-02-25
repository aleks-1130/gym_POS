const prisma = require('../../config/prisma');
const { isDatabaseUnreachableError } = require('../../utils/prismaError');

const getSettings = async (req, res) => {
    try {
        let profile = await prisma.gymProfile.findFirst();
        if (!profile) {
            // Create default if not exists
            profile = await prisma.gymProfile.create({
                data: {
                    name: 'FitOS Gym',
                    address: '123 Fitness Blvd, Gym City',
                    phone: '(555) 123-4567',
                    email: 'contact@fitos.com',
                    website: 'www.fitos.com'
                }
            });
        }
        res.json(profile);
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
    try {
        const { name, address, phone, email, website } = req.body;

        let profile = await prisma.gymProfile.findFirst();

        if (profile) {
            profile = await prisma.gymProfile.update({
                where: { id: profile.id },
                data: { name, address, phone, email, website }
            });
        } else {
            profile = await prisma.gymProfile.create({
                data: { name, address, phone, email, website }
            });
        }

        res.json(profile);
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
