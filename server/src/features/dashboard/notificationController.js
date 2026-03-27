const prisma = require('../../config/prisma');
const notificationService = require('../../services/notificationService');

const getNotifications = async (req, res) => {
    try {
        const { tenantId, gymId, role } = req.user;
        const memberId = req.query.memberId ? parseInt(req.query.memberId) : null;
        
        // Find member associated with user if not provided
        let targetMemberId = memberId;
        if (role === 'MEMBER') {
            const member = await prisma.member.findFirst({ 
                where: { 
                    email: { equals: req.user.email, mode: 'insensitive' },
                    tenantId: tenantId || 1 // Fallback to avoid Prisma error if middleware somehow fails
                } 
            });
            targetMemberId = member?.id;
        } else if (targetMemberId && (role === 'STAFF' || role === 'ADMIN')) {
            // VERIFY: Staff can only see notifications for members in their branch
            const member = await prisma.member.findFirst({
                where: { id: targetMemberId, gymId, tenantId },
                select: { id: true }
            });
            if (!member) return res.status(403).json({ error: "Access denied to member notifications" });
        }

        const where = {
            tenantId,
            OR: [
                { targetGroup: 'ALL', memberId: null, gymId: (role === 'OWNER' ? undefined : gymId) },
                { 
                    isAnnouncement: true, 
                    OR: [
                        { targetGroup: 'ALL', gymId: (role === 'OWNER' ? undefined : (gymId || null)) },
                        { targetGroup: 'ALL', gymId: null } // Explicitly include global announcements
                    ]
                },
                // Role-based targeting
                ...(role === 'ADMIN' || role === 'OWNER' || role === 'STAFF' 
                    ? [{ targetGroup: 'STAFF', gymId: (role === 'OWNER' ? undefined : gymId) }] 
                    : []),
                ...(role === 'TRAINER' ? [{ targetGroup: 'TRAINER', gymId }] : []),
                // Direct member notifications
                ...(targetMemberId ? [{ memberId: targetMemberId }] : []),
                // Class-based targeting
                ...(targetMemberId ? [{
                    targetGroup: 'CLASS',
                    targetId: {
                        in: (await prisma.booking.findMany({
                            where: { memberId: targetMemberId, status: 'CONFIRMED', tenantId },
                            select: { classId: true }
                        })).map(b => b.classId)
                    }
                }] : [])
            ]
        };

        const notifs = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(notifs);
    } catch (e) {
        console.error('[NotificationController] Error ==>', e.message, e);
        res.status(500).json({ error: e.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { tenantId, gymId, role } = req.user;
        const { id } = req.params;
        
        // Ownership check
        const existing = await prisma.notification.findFirst({
            where: { id: parseInt(id), tenantId }
        });
        if (!existing) return res.status(404).json({ error: "Notification not found" });
        if (role !== 'OWNER' && existing.gymId && existing.gymId !== gymId) {
             return res.status(403).json({ error: "Access denied" });
        }

        await prisma.notification.update({
            where: { id: parseInt(id) },
            data: { isRead: true }
        });
        console.log(`[DEBUG] Successfully marked notification ${id} as read`);
        res.json({ success: true });
    } catch (e) {
        console.error('[NotificationController] Mark as read error:', e);
        res.status(500).json({ error: "Failed to mark notification as read" });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const { tenantId, gymId, role } = req.user;
        
        let targetMemberId = null;
        if (role === 'MEMBER') {
            const member = await prisma.member.findFirst({ 
                where: { 
                    email: { equals: req.user.email, mode: 'insensitive' },
                    tenantId: tenantId || 1
                } 
            });
            targetMemberId = member?.id;
        }

        const where = {
            tenantId,
            isRead: false,
            OR: [
                { targetGroup: 'ALL', memberId: null, gymId: (role === 'OWNER' ? undefined : gymId) },
                { isAnnouncement: true, targetGroup: 'ALL', gymId: (role === 'OWNER' ? undefined : gymId) },
                ...(role === 'ADMIN' || role === 'OWNER' || role === 'STAFF' 
                    ? [{ targetGroup: 'STAFF', gymId: (role === 'OWNER' ? undefined : gymId) }] 
                    : []),
                ...(role === 'TRAINER' ? [{ targetGroup: 'TRAINER', gymId }] : []),
                ...(targetMemberId ? [{ memberId: targetMemberId }] : []),
                ...(targetMemberId ? [{ targetGroup: 'CLASS' }] : [])
            ]
        };

        const result = await prisma.notification.updateMany({
            where: where,
            data: { isRead: true }
        });

        console.log(`[DEBUG] Mark All as Read triggered. Count: ${result.count}`);
        res.json({ success: true, count: result.count });
    } catch (e) {
        console.error('[NotificationController] Mark all as read error:', e);
        res.status(500).json({ error: "Failed to mark all as read" });
    }
};

const broadcastAnnouncement = async (req, res) => {
    try {
        const { tenantId, gymId } = req.user;
        const { title, message, type = 'ANNOUNCEMENT', targetGroup = 'ALL', targetId = null } = req.body;
        const notification = await notificationService.send({
            title,
            message,
            type,
            isAnnouncement: true,
            tenantId,
            gymId, // Broadcast from current branch
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
        const { tenantId, gymId, role } = req.user;
        const { id } = req.params;
        const where = { id: parseInt(id), tenantId };
        if (role !== 'OWNER') {
            where.gymId = gymId;
        }
        await prisma.notification.deleteMany({
            where: where
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
    markAllAsRead,
    broadcastAnnouncement,
    deleteNotification
};
