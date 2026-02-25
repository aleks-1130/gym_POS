const prisma = require('../../config/prisma');

const getNotifications = async (req, res) => {
    try {
        const notifs = await prisma.notification.findMany({
            orderBy: { date: 'desc' },
            take: 50
        });
        res.json(notifs);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};

module.exports = {
    getNotifications
};
