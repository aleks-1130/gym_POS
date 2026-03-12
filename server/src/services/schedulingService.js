const cron = require('node-cron');
const prisma = require('../config/prisma');
const notificationService = require('./notificationService');

/**
 * Scheduling Service
 * Handles background tasks like reminders and recurring session generation
 */
const schedulingService = {
    init() {
        console.log('[SchedulingService] Initializing background tasks...');

        // 1. Session Reminders (Hourly)
        cron.schedule('0 * * * *', () => {
            this.sendSessionReminders();
            this.sendTrainingReminders();
        });

        // 2. Clear old notifications (Every Sunday at midnight)
        cron.schedule('0 0 * * 0', this.cleanupNotifications);
    },

    /**
     * Send reminders for classes happening soon
     */
    async sendSessionReminders() {
        console.log('[SchedulingService] Checking for upcoming class reminders...');
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        try {
            const bookings = await prisma.booking.findMany({
                where: {
                    sessionDate: {
                        gte: now,
                        lte: tomorrow
                    },
                    status: 'CONFIRMED'
                },
                include: {
                    member: true,
                    class: {
                        include: { trainer: true }
                    }
                }
            });

            for (const booking of bookings) {
                if (booking.member?.email) {
                    await notificationService.send({
                        memberId: booking.memberId,
                        title: 'Upcoming Class Reminder 🔔',
                        message: `Reminder: You have the class "${booking.class.name}" with ${booking.class.trainer?.name || 'your trainer'} scheduled for tomorrow.`,
                        type: 'CLASS_REMINDER',
                        eventData: {
                            className: booking.class.name,
                            trainerName: booking.class.trainer?.name || 'Staff',
                            sessionDate: booking.sessionDate.toLocaleDateString(),
                            time: booking.class.time
                        }
                    });
                }
            }
            if (bookings.length > 0) console.log(`[SchedulingService] Sent ${bookings.length} class reminders.`);
        } catch (error) {
            console.error('[SchedulingService] Error sending class reminders:', error);
        }
    },

    /**
     * Send reminders for personal training sessions happening soon
     */
    async sendTrainingReminders() {
        console.log('[SchedulingService] Checking for upcoming training reminders...');
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        try {
            const sessions = await prisma.trainingSession.findMany({
                where: {
                    date: {
                        gte: now,
                        lte: tomorrow
                    },
                    status: 'SCHEDULED'
                },
                include: {
                    member: true,
                    trainer: true
                }
            });

            for (const session of sessions) {
                if (session.member?.email) {
                    await notificationService.send({
                        memberId: session.memberId,
                        title: 'Personal Training Reminder 💪',
                        message: `Reminder: Your session with Coach ${session.trainer?.name || 'Staff'} is scheduled for tomorrow at ${new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
                        type: 'TRAINING_REMINDER',
                        eventData: {
                            className: 'Personal Training',
                            trainerName: session.trainer?.name || 'Staff',
                            sessionDate: session.date.toLocaleDateString(),
                            time: new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                    });
                }
            }
            if (sessions.length > 0) console.log(`[SchedulingService] Sent ${sessions.length} training reminders.`);
        } catch (error) {
            console.error('[SchedulingService] Error sending training reminders:', error);
        }
    },

    /**
     * Remove read notifications older than 30 days
     */
    async cleanupNotifications() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            const result = await prisma.notification.deleteMany({
                where: {
                    isRead: true,
                    date: { lt: thirtyDaysAgo }
                }
            });
            console.log(`[SchedulingService] Cleaned up ${result.count} old notifications.`);
        } catch (error) {
            console.error('[SchedulingService] Error cleaning up notifications:', error);
        }
    }
};

module.exports = schedulingService;
