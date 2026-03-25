const prisma = require('../../config/prisma');

const getPreferences = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        
        let where = {};
        if (role === 'MEMBER') {
            const member = await prisma.member.findFirst({ 
                where: { 
                    email: { equals: req.user.email, mode: 'insensitive' },
                    tenantId: Number(req.user.tenantId)
                } 
            });
            if (!member) return res.status(404).json({ error: "Member not found" });
            where = { memberId: member.id };
        } else {
            where = { userId: userId };
        }

        let preferences = await prisma.notificationPreference.findUnique({
            where
        });

        // Create defaults if not found
        if (!preferences) {
            preferences = await prisma.notificationPreference.create({
                data: {
                    ...where,
                    tenantId: Number(req.user.tenantId),
                    emailAnnouncements: true,
                    emailReminders: true,
                    emailReceipts: true,
                    appAnnouncements: true,
                    appReminders: true,
                    appReceipts: true
                }
            });
        }

        res.json(preferences);
    } catch (e) {
        console.error('[PreferenceController] Get error:', e);
        res.status(500).json({ error: "Failed to fetch preferences" });
    }
};

const updatePreferences = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const updates = req.body;
        
        // Sanitize updates to only allow preference fields
        const allowedFields = [
            'emailAnnouncements', 'emailReminders', 'emailReceipts',
            'appAnnouncements', 'appReminders', 'appReceipts'
        ];
        
        const data = {};
        allowedFields.forEach(field => {
            if (typeof updates[field] === 'boolean') {
                data[field] = updates[field];
            }
        });

        let where = {};
        if (role === 'MEMBER') {
            const member = await prisma.member.findFirst({ 
                where: { 
                    email: { equals: req.user.email, mode: 'insensitive' },
                    tenantId: Number(req.user.tenantId)
                } 
            });
            if (!member) return res.status(404).json({ error: "Member not found" });
            where = { memberId: member.id };
        } else {
            where = { userId: userId };
        }

        const preferences = await prisma.notificationPreference.upsert({
            where,
            update: data,
            create: {
                ...where,
                ...data,
                tenantId: Number(req.user.tenantId)
            }
        });

        res.json(preferences);
    } catch (e) {
        console.error('[PreferenceController] Update error:', e);
        res.status(500).json({ error: "Failed to update preferences" });
    }
};

module.exports = {
    getPreferences,
    updatePreferences
};
