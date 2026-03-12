const prisma = require('../../config/prisma');
const notificationService = require('../../services/notificationService');

const getNotifications = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const memberId = req.query.memberId ? parseInt(req.query.memberId) : null;
        
        // Find member associated with user if not provided
        let targetMemberId = memberId;
        if (!targetMemberId && role === 'MEMBER') {
            const member = await prisma.member.findFirst({ where: { email: req.user.email } });
            targetMemberId = member?.id;
        }

        const where = {
            OR: [
                { targetGroup: 'ALL' },
                { isAnnouncement: true, targetGroup: 'ALL' },
                // Role-based targeting
                ...(role === 'ADMIN' || role === 'OWNER' || role === 'STAFF' 
                    ? [{ targetGroup: 'STAFF' }] 
                    : []),
                ...(role === 'TRAINER' ? [{ targetGroup: 'TRAINER' }] : []),
                // Direct member notifications
                ...(targetMemberId ? [{ memberId: targetMemberId }] : []),
                // Class-based targeting (if member is in that class)
                ...(targetMemberId ? [{
                    targetGroup: 'CLASS',
                    targetId: {
                        in: (await prisma.booking.findMany({
                            where: { memberId: targetMemberId, status: 'CONFIRMED' },
                            select: { classId: true }
                        })).map(b => b.classId)
                    }
                }] : [])
            ]
        };

        const notifs = await prisma.notification.findMany({
            where: (role === 'ADMIN' || role === 'OWNER') && !memberId ? {} : where,
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(notifs);
    } catch (e) {
        console.error('[NotificationController] Error:', e);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.update({
            where: { id: parseInt(id) },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to mark notification as read" });
    }
};

const broadcastAnnouncement = async (req, res) => {
    try {
        const { title, message, type = 'ANNOUNCEMENT', targetGroup = 'ALL', targetId = null } = req.body;
        const notification = await notificationService.send({
            title,
            message,
            type,
            isAnnouncement: true,
            eventData: {
                targetGroup,
                targetId: targetId ? parseInt(targetId) : null
            }
        });

        // Update the created notification with targeting data
        if (notification) {
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    targetGroup,
                    targetId: targetId ? parseInt(targetId) : null
                }
            });
        }

        res.json(notification);
    } catch (e) {
        console.error('[NotificationController] Broadcast error:', e);
        res.status(500).json({ error: "Failed to broadcast announcement" });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true, message: "Notification deleted successfully" });
    } catch (e) {
        console.error('[NotificationController] Delete error:', e);
        res.status(500).json({ error: "Failed to delete notification" });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    broadcastAnnouncement,
    deleteNotification
};
