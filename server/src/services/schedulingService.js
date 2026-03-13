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
        const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours out for final check
        
        try {
            // 1. Initial 24-hour Reminders (Email + App)
            const initialBookings = await prisma.booking.findMany({
                where: {
                    sessionDate: {
                        gt: now,
                        lte: tomorrow
                    },
                    status: 'CONFIRMED',
                    reminderSent: false
                },
                include: {
                    member: true,
                    class: { include: { trainer: true } }
                }
            });

            for (const booking of initialBookings) {
                const sessionDate = new Date(booking.sessionDate);
                const isToday = sessionDate.toDateString() === now.toDateString();
                const dayLabel = isToday ? 'today' : 'tomorrow';

                await notificationService.send({
                    memberId: booking.memberId,
                    title: 'Upcoming Class Reminder 🔔',
                    message: `Reminder: You have the class "${booking.class.name}" with ${booking.class.trainer?.name || 'your trainer'} scheduled for ${dayLabel}.`,
                    type: 'CLASS_REMINDER',
                    isAnnouncement: true, // Show on News & Broadcasts
                    eventData: {
                        className: booking.class.name,
                        trainerName: booking.class.trainer?.name || 'Staff',
                        sessionDate: sessionDate.toLocaleDateString(),
                        time: booking.class.time,
                        dayLabel
                    }
                });

                await prisma.booking.update({
                    where: { id: booking.id },
                    data: { reminderSent: true }
                });
            }

            // 2. Final 1-hour Reminders (App ONLY Highlights)
            const finalBookings = await prisma.booking.findMany({
                where: {
                    sessionDate: {
                        gt: now,
                        lte: soon
                    },
                    status: 'CONFIRMED',
                    finalReminderSent: false
                },
                include: {
                    member: true,
                    class: { include: { trainer: true } }
                }
            });

            for (const booking of finalBookings) {
                const sessionDate = new Date(booking.sessionDate);
                await notificationService.send({
                    memberId: booking.memberId,
                    title: 'Final Call! 🚀',
                    message: `Your class "${booking.class.name}" starts in about an hour! See you at ${booking.class.time}.`,
                    type: 'CLASS_REMINDER',
                    isAnnouncement: true,
                    excludeEmail: true, // App only for 1-hour out
                    eventData: {
                        className: booking.class.name,
                        time: booking.class.time
                    }
                });

                await prisma.booking.update({
                    where: { id: booking.id },
                    data: { finalReminderSent: true }
                });
            }

            const total = initialBookings.length + finalBookings.length;
            if (total > 0) console.log(`[SchedulingService] Sent ${initialBookings.length} initial and ${finalBookings.length} final class reminders.`);
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
        const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        try {
            // 1. Initial 24-hour Reminders (Email + App)
            const initialSessions = await prisma.trainingSession.findMany({
                where: {
                    date: {
                        gt: now,
                        lte: tomorrow
                    },
                    status: 'SCHEDULED',
                    reminderSent: false
                },
                include: { member: true, trainer: true }
            });

            for (const session of initialSessions) {
                const sessionDate = new Date(session.date);
                const isToday = sessionDate.toDateString() === now.toDateString();
                const dayLabel = isToday ? 'today' : 'tomorrow';

                await notificationService.send({
                    memberId: session.memberId,
                    title: 'Personal Training Reminder 💪',
                    message: `Reminder: Your session with Coach ${session.trainer?.name || 'Staff'} is scheduled for ${dayLabel} at ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
                    type: 'TRAINING_REMINDER',
                    isAnnouncement: true, // Show on News & Broadcasts
                    eventData: {
                        className: 'Personal Training',
                        trainerName: session.trainer?.name || 'Staff',
                        sessionDate: sessionDate.toLocaleDateString(),
                        time: sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        dayLabel
                    }
                });

                await prisma.trainingSession.update({
                    where: { id: session.id },
                    data: { reminderSent: true }
                });
            }

            // 2. Final 1-hour Reminders (App ONLY Highlights)
            const finalSessions = await prisma.trainingSession.findMany({
                where: {
                    date: {
                        gt: now,
                        lte: soon
                    },
                    status: 'SCHEDULED',
                    finalReminderSent: false
                },
                include: { member: true, trainer: true }
            });

            for (const session of finalSessions) {
                const sessionDate = new Date(session.date);
                await notificationService.send({
                    memberId: session.memberId,
                    title: 'Training Starting Soon! 💪',
                    message: `Get ready! Your session with Coach ${session.trainer?.name || 'Staff'} starts in about an hour (${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
                    type: 'TRAINING_REMINDER',
                    isAnnouncement: true,
                    excludeEmail: true,
                    eventData: {
                        trainerName: session.trainer?.name || 'Staff',
                        time: sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                });

                await prisma.trainingSession.update({
                    where: { id: session.id },
                    data: { finalReminderSent: true }
                });
            }

            const total = initialSessions.length + finalSessions.length;
            if (total > 0) console.log(`[SchedulingService] Sent ${initialSessions.length} initial and ${finalSessions.length} final training reminders.`);
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
