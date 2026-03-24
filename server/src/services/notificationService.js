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
    async send({ memberId, title, message, type = 'INFO', isAnnouncement = false, eventData = {}, excludeEmail = false, gymId = null }) {
        try {
            // 0. Fetch Preferences (if applicable)
            let prefs = null;
            if (memberId) {
                prefs = await prisma.notificationPreference.findUnique({
                    where: { memberId: parseInt(memberId) }
                });
            }

            // Default to true if no preference record exists yet
            const shouldSendApp = isAnnouncement 
                ? (prefs?.appAnnouncements ?? true)
                : (prefs?.appReminders ?? true);
            
            const shouldSendEmail = isAnnouncement
                ? (prefs?.emailAnnouncements ?? true)
                : (prefs?.emailReminders ?? true);

            // 1. Create In-App Notification (if allowed)
            let notification = null;
            if (shouldSendApp || !memberId) { // Always record broadcasts in-app for now
                notification = await prisma.notification.create({
                    data: {
                        title,
                        message,
                        type,
                        isAnnouncement,
                        targetGroup: memberId ? 'PRIVATE' : (eventData.targetGroup || 'ALL'),
                        memberId: memberId ? parseInt(memberId) : null,
                        gymId: gymId || null
                    }
                });
            }

            // 2. Trigger n8n Email (if webhook URL exists)
            console.log(`[NotificationService] Preparing to trigger n8n for: ${title} (Announcement: ${isAnnouncement})`);
            
            // Normalize eventType for n8n Switch node
            let normalizedEventType = type;
            if (isAnnouncement) {
                normalizedEventType = 'ANNOUNCEMENT';
            } else if (type === 'TRAINING_BOOKED') {
                normalizedEventType = 'TRAINING_REMINDER';
            } else if (type === 'BOOKING_CONFIRMED') {
                normalizedEventType = 'CLASS_REMINDER';
            }

            const basePayload = {
                title,
                message,
                eventType: normalizedEventType,
                category: type, // Original type (INFO, ALERT, PROMO, etc.)
                dayLabel: eventData.dayLabel || 'Upcoming', // Fallback for immediate bookings
                ...eventData
            };

            // Only trigger n8n for announcements or specific membership events
            if (process.env.N8N_NOTIFICATIONS_WEBHOOK_URL && !excludeEmail && (shouldSendEmail || !memberId)) {
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
    async sendReceipt(args) {
        const { memberId, amount, method, items, receiptId, referenceId, gymId = null, taxAmount = 0, discountAmount = 0, subtotal = 0, gymName = null, gymLogo = null, cashierName, cashTendered, changeDue, paymentDate, companyId, collections = [], customerEmail = null, customerName = null } = args;
        try {
            console.log(`\n--- [NOTIFICATION_SERVICE_START] ---`);
            console.log(`[NotificationService] Processing Receipt: ${receiptId}`);
            console.log(`[NotificationService] Args:`, JSON.stringify({ memberId, customerEmail, method, amount }, null, 2));

            let member = null;
            if (memberId) {
                console.log(`[NotificationService] Fetching Member Data for ID: ${memberId}`);
                member = await prisma.member.findUnique({
                    where: { id: parseInt(memberId) },
                    select: { email: true, firstName: true, lastName: true }
                });
                console.log(`[NotificationService] Member found: ${member ? 'YES' : 'NO'} (${member?.email || 'no-email'})`);
            }

            const targetEmail = (member?.email || customerEmail || '').trim();
            const targetName = member ? `${member.firstName} ${member.lastName}` : (customerName || 'Walk-in Customer');

            console.log(`[NotificationService] Target: ${targetName} <${targetEmail}>`);

            const payload = {
                eventType: 'PAYMENT_RECEIPT',
                name: targetName,
                email: targetEmail,
                amount: Number(amount),
                method,
                items: Array.isArray(items) ? items : [items],
                receiptId,
                referenceId,
                taxAmount,
                discountAmount,
                subtotal,
                gymName,
                gymLogo,
                cashierName,
                cashTendered,
                changeDue,
                paymentDate,
                companyId,
                branchName: gymName,
                collections,
                heartbeat: 'FINAL_SPLIT_V3'
            };

            console.log('[NotificationService] DISPATCHING TO N8N:', JSON.stringify(payload, null, 2));

            // Fetch Preferences for receipt
            let prefs = null;
            if (memberId) {
                prefs = await prisma.notificationPreference.findUnique({
                    where: { memberId: parseInt(memberId) }
                });
            }
            
            const shouldSendApp = prefs?.appReceipts ?? true;
            const shouldSendEmail = prefs?.emailReceipts ?? true;

            // In-app record for the member
            if (memberId && shouldSendApp) {
                await prisma.notification.create({
                    data: {
                        title: 'Payment Received',
                        message: `Your payment of ₱${amount.toLocaleString()} has been processed. Receipt: ${receiptId}`,
                        type: 'PAYMENT_RECEIPT',
                        targetGroup: 'PRIVATE',
                        memberId: parseInt(memberId),
                        gymId: gymId || null
                    }
                });
            }

            if (process.env.N8N_NOTIFICATIONS_WEBHOOK_URL && shouldSendEmail && payload.email) {
                console.log(`[NotificationService] DISPATCHING to: ${process.env.N8N_NOTIFICATIONS_WEBHOOK_URL}`);
                await sendEmailWebhook(process.env.N8N_NOTIFICATIONS_WEBHOOK_URL, payload);
            } else {
                console.log(`[NotificationService] SKIPPED DISPATCH. Reason:`, { 
                    urlSet: !!process.env.N8N_NOTIFICATIONS_WEBHOOK_URL, 
                    shouldSendEmail, 
                    hasEmail: !!payload.email 
                });
                if (!process.env.N8N_NOTIFICATIONS_WEBHOOK_URL) console.warn(`[NotificationService] Skipped: N8N_NOTIFICATIONS_WEBHOOK_URL is not set.`);
                else if (!shouldSendEmail) console.warn(`[NotificationService] Skipped: emailReceipts is disabled for this user.`);
                else if (!payload.email) console.warn(`[NotificationService] Skipped: No email address provided for this transaction.`);
            }
            console.log(`--- [NOTIFICATION_SERVICE_END] ---\n`);
        } catch (error) {
            console.error('[NotificationService] Error sending receipt:', error);
            console.log(`--- [NOTIFICATION_SERVICE_ERROR] ---\n`);
        }
    }
};

module.exports = notificationService;
