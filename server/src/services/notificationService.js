const prisma = require('../config/prisma');
const { sendEmailWebhook } = require('./emailService');

/**
 * Unified Notification Service
 * Handles both in-app Prisma records and n8n Email triggers
 */
const notificationService = {
    /**
     * Send a notification to a specific member or broadcast to all
     */
    async send({ memberId, title, message, type = 'INFO', isAnnouncement = false, eventData = {} }) {
        try {
            // 1. Create In-App Notification
            const notification = await prisma.notification.create({
                data: {
                    title,
                    message,
                    type,
                    isAnnouncement,
                    memberId: memberId ? parseInt(memberId) : null
                }
            });

            // 2. Trigger n8n Email (if webhook URL exists)
            console.log(`[NotificationService] Preparing to trigger n8n for: ${title} (Announcement: ${isAnnouncement})`);
            const emailPayload = {
                title,
                message,
                eventType: type,
                ...eventData
            };

            if (memberId) {
                const member = await prisma.member.findUnique({
                    where: { id: parseInt(memberId) },
                    select: { email: true, firstName: true, lastName: true }
                });
                if (member && member.email) {
                    emailPayload.email = member.email;
                    emailPayload.name = `${member.firstName} ${member.lastName}`;
                }
            }

            // Only trigger n8n for announcements or specific membership events
            if (process.env.N8N_NOTIFICATIONS_WEBHOOK_URL) {
                // If it's a private notification, only send if we have an email
                if (!memberId || (memberId && emailPayload.email)) {
                    console.log(`[NotificationService] Dispatching to unified-notifications webhook for ${emailPayload.email || 'ALL'}`);
                    await sendEmailWebhook(process.env.N8N_NOTIFICATIONS_WEBHOOK_URL, emailPayload);
                } else {
                    console.warn(`[NotificationService] Skipped: Private notification for ID ${memberId} but no email found.`);
                }
            } else {
                console.warn(`[NotificationService] Skipped: N8N_NOTIFICATIONS_WEBHOOK_URL is not set.`);
            }

            return notification;
        } catch (error) {
            console.error('[NotificationService] Error sending notification:', error);
        }
    },

    /**
     * Specifically send a payment receipt
     */
    async sendReceipt({ memberId, amount, method, items, receiptId, referenceId }) {
        try {
            const member = memberId ? await prisma.member.findUnique({
                where: { id: parseInt(memberId) },
                select: { email: true, firstName: true, lastName: true }
            }) : null;

            const payload = {
                eventType: 'PAYMENT_RECEIPT',
                name: member ? `${member.firstName} ${member.lastName}` : 'Valued Customer',
                email: member?.email,
                amount,
                method,
                items: Array.isArray(items) ? items : [items],
                receiptId,
                referenceId
            };

            // In-app record for the member
            if (memberId) {
                await prisma.notification.create({
                    data: {
                        title: 'Payment Received',
                        message: `Your payment of ₱${amount.toLocaleString()} has been processed. Receipt: ${receiptId}`,
                        type: 'PAYMENT_RECEIPT',
                        memberId: parseInt(memberId)
                    }
                });
            }

            if (process.env.N8N_NOTIFICATIONS_WEBHOOK_URL && (member?.email || !memberId)) {
                console.log(`[NotificationService] Dispatching receipt to unified-notifications webhook for ${member?.email || 'Walk-in'}`);
                await sendEmailWebhook(process.env.N8N_NOTIFICATIONS_WEBHOOK_URL, payload);
            } else {
                console.warn(`[NotificationService] Skipped receipt webhook (URL missing or no recipient email)`);
            }
        } catch (error) {
            console.error('[NotificationService] Error sending receipt:', error);
        }
    }
};

module.exports = notificationService;
