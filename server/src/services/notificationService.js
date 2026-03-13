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
            
            const basePayload = {
                title,
                message,
                eventType: type,
                ...eventData
            };

            // Only trigger n8n for announcements or specific membership events
            if (process.env.N8N_NOTIFICATIONS_WEBHOOK_URL) {
                if (isAnnouncement && !memberId) {
                    // BROADCAST CASE: Resolve target group and send individual emails
                    console.log(`[NotificationService] Resolving recipients for broadcast group: ${eventData.targetGroup || 'ALL'}`);
                    
                    let recipients = [];
                    const targetGroup = eventData.targetGroup || 'ALL';

                    if (targetGroup === 'ALL') {
                        recipients = await prisma.member.findMany({
                            where: { status: 'ACTIVE', email: { not: null } },
                            select: { email: true, firstName: true, lastName: true }
                        });
                    } else if (targetGroup === 'STAFF') {
                        recipients = await prisma.user.findMany({
                            where: { status: 'ACTIVE', role: { in: ['ADMIN', 'STAFF', 'OWNER'] } },
                            select: { email: true, name: true }
                        });
                    } else if (targetGroup === 'TRAINER') {
                        recipients = await prisma.user.findMany({
                            where: { status: 'ACTIVE', role: 'TRAINER' },
                            select: { email: true, name: true }
                        });
                    } else if (targetGroup === 'CLASS' && eventData.targetId) {
                        const bookings = await prisma.booking.findMany({
                            where: { classId: eventData.targetId, status: 'CONFIRMED' },
                            include: { member: { select: { email: true, firstName: true, lastName: true } } }
                        });
                        recipients = bookings.map(b => b.member).filter(m => m && m.email);
                    }

                    console.log(`[NotificationService] Found ${recipients.length} recipients for broadcast.`);

                    // Trigger webhooks in batches to avoid overwhelming n8n/Gmail
                    for (const recipient of recipients) {
                        const individualPayload = {
                            ...basePayload,
                            email: recipient.email,
                            name: recipient.name || `${recipient.firstName} ${recipient.lastName}`
                        };
                        // We don't await each to speed it up, but we log the attempt
                        sendEmailWebhook(process.env.N8N_NOTIFICATIONS_WEBHOOK_URL, individualPayload).catch(e => {
                            console.error(`[NotificationService] Async webhook failed for ${recipient.email}:`, e.message);
                        });
                    }
                } else if (memberId) {
                    // DIRECT MEMBER CASE: Single recipient
                    const member = await prisma.member.findUnique({
                        where: { id: parseInt(memberId) },
                        select: { email: true, firstName: true, lastName: true }
                    });
                    
                    if (member && member.email) {
                        const directPayload = {
                            ...basePayload,
                            email: member.email,
                            name: `${member.firstName} ${member.lastName}`
                        };
                        console.log(`[NotificationService] Dispatching private notification to ${member.email}`);
                        await sendEmailWebhook(process.env.N8N_NOTIFICATIONS_WEBHOOK_URL, directPayload);
                    } else {
                        console.warn(`[NotificationService] Skipped: Private notification for ID ${memberId} but no email found.`);
                    }
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
