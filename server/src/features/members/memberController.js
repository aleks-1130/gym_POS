const prisma = require('../../config/prisma');
const { isTimeAllowedForTrainer } = require('../../services/trainerAvailabilityService');
const { sendActivationEmail } = require('../../services/emailService');
const notificationService = require('../../services/notificationService');
const crypto = require('crypto');
const { PAYMENT_METHODS } = require('../../config/businessConfig');
const {
    resolveClassSessionStart,
    getDayBounds
} = require('../training/classScheduleUtils');

const FINALIZED_SESSION_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'DECLINED'];
const ACTIVE_OCCUPANCY_STATUSES = ['CONFIRMED', 'ATTENDED'];
const BOOKED_STATUSES = ['CONFIRMED', 'ATTENDED', 'WAITLISTED'];
const RATING_MIN = 1;
const RATING_MAX = 5;
const RATING_COMMENT_MAX_LENGTH = 500;

const toLocalIsoDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const toSessionKey = (classId, sessionDate) => `${Number(classId)}|${new Date(sessionDate).getTime()}`;

const createPaymentCompat = async (tx, data) => {
    const paymentData = { ...data };
    const removableOptionalFields = new Set(['discount', 'cashTendered', 'changeDue', 'externalRef', 'externalDate']);
    const originalMemberId = paymentData.memberId;
    const originalCashierId = paymentData.cashierId;

    // Use relation connect to avoid schema/client drift around scalar FK fields.
    if (paymentData.memberId !== undefined) {
        const memberId = paymentData.memberId;
        delete paymentData.memberId;
        if (memberId !== null) {
            paymentData.member = { connect: { id: Number(memberId) } };
        }
    }
    if (paymentData.cashierId !== undefined) {
        const cashierId = paymentData.cashierId;
        delete paymentData.cashierId;
        if (cashierId !== null) {
            paymentData.cashier = { connect: { id: Number(cashierId) } };
        }
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return await tx.payment.create({ data: paymentData });
        } catch (err) {
            const unknownArg = /Unknown argument `([^`]+)`/.exec(err?.message || '')?.[1];
            if (!unknownArg) {
                throw err;
            }

            if (unknownArg === 'member' && originalMemberId !== undefined) {
                delete paymentData.member;
                paymentData.memberId = originalMemberId;
                continue;
            }
            if (unknownArg === 'cashier' && originalCashierId !== undefined) {
                delete paymentData.cashier;
                paymentData.cashierId = originalCashierId;
                continue;
            }
            if (unknownArg === 'memberId' && originalMemberId !== undefined) {
                delete paymentData.memberId;
                if (originalMemberId !== null) {
                    paymentData.member = { connect: { id: Number(originalMemberId) } };
                }
                continue;
            }
            if (unknownArg === 'cashierId' && originalCashierId !== undefined) {
                delete paymentData.cashierId;
                if (originalCashierId !== null) {
                    paymentData.cashier = { connect: { id: Number(originalCashierId) } };
                }
                continue;
            }
            if (removableOptionalFields.has(unknownArg) && (unknownArg in paymentData)) {
                delete paymentData[unknownArg];
                continue;
            }

            throw err;
        }
    }
};

const getPlanClassSessions = (plan) => {
    if (!plan || !plan.includesClasses) return 0;
    const included = Number(plan.includedClassSessions || 0);
    return Number.isInteger(included) && included > 0 ? included : 0;
};

const applyPlanClassSessions = async ({ tx, memberId, plan }) => {
    const grantedSessions = getPlanClassSessions(plan);
    if (grantedSessions <= 0) return;
    await tx.member.update({
        where: { id: Number(memberId) },
        data: {
            classSessionsRemaining: { increment: grantedSessions }
        }
    });
};

const getMembers = async (req, res) => {
    try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        const search = req.query.search;

        const baseWhere = { status: { not: 'DELETED' } };
        const where = { ...baseWhere };

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const queryOptions = {
            where,
            include: { plan: true },
            orderBy: { createdAt: 'desc' }
        };

        if (page && limit) {
            const skip = (page - 1) * limit;
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const [members, total] = await Promise.all([
                prisma.member.findMany({
                    ...queryOptions,
                    skip,
                    take: limit
                }),
                prisma.member.count({ where: queryOptions.where })
            ]);

            const [globalTotal, expiredByStatus, expiredByDateOnly, active, freezed] = await Promise.all([
                prisma.member.count({ where: baseWhere }),
                prisma.member.count({ where: { ...baseWhere, status: 'EXPIRED' } }),
                prisma.member.count({
                    where: {
                        ...baseWhere,
                        status: { not: 'EXPIRED' },
                        expiryDate: { lt: todayStart }
                    }
                }),
                prisma.member.count({
                    where: {
                        ...baseWhere,
                        status: 'ACTIVE',
                        OR: [{ expiryDate: null }, { expiryDate: { gte: todayStart } }]
                    }
                }),
                prisma.member.count({
                    where: {
                        ...baseWhere,
                        status: 'FREEZED',
                        OR: [{ expiryDate: null }, { expiryDate: { gte: todayStart } }]
                    }
                })
            ]);
            const expired = expiredByStatus + expiredByDateOnly;

            return res.json({
                data: members,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    statusTotals: {
                        total: globalTotal,
                        active,
                        freezed,
                        expired
                    }
                }
            });
        }

        const members = await prisma.member.findMany(queryOptions);
        res.json(members);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const deleteMember = async (req, res) => {
    const { id } = req.params;
    const memberId = Number(id);

    if (!Number.isInteger(memberId)) {
        return res.status(400).json({ error: "Invalid member ID" });
    }

    try {
        const deletedSummary = await prisma.$transaction(async (tx) => {
            const existingMember = await tx.member.findUnique({
                where: { id: memberId },
                select: { id: true }
            });

            if (!existingMember) {
                return null;
            }

            // Keep class slot counts accurate before removing bookings.
            const confirmedBookings = await tx.booking.findMany({
                where: { memberId, status: 'CONFIRMED' },
                select: { classId: true }
            });

            const bookingCountsByClass = confirmedBookings.reduce((acc, booking) => {
                acc[booking.classId] = (acc[booking.classId] || 0) + 1;
                return acc;
            }, {});

            for (const [classIdRaw, count] of Object.entries(bookingCountsByClass)) {
                const classId = Number(classIdRaw);
                const cls = await tx.class.findUnique({
                    where: { id: classId },
                    select: { enrolled: true }
                });

                if (cls) {
                    await tx.class.update({
                        where: { id: classId },
                        data: {
                            enrolled: Math.max(0, Number(cls.enrolled || 0) - count)
                        }
                    });
                }
            }

            const deletedSessionMaterials = await tx.sessionMaterial.deleteMany({
                where: {
                    session: { memberId }
                }
            });

            const deletedPaymentItems = await tx.paymentItem.deleteMany({
                where: {
                    payment: { memberId }
                }
            });

            const deletedOrderItems = await tx.orderItem.deleteMany({
                where: {
                    order: { memberId }
                }
            });

            const deletedAccessLogs = await tx.accessLog.deleteMany({ where: { memberId } });
            const deletedPaymentMethods = await tx.paymentMethod.deleteMany({ where: { memberId } });
            const deletedMemberNotes = await tx.memberNote.deleteMany({ where: { memberId } });
            const deletedMembershipPeriods = await tx.membershipPeriod.deleteMany({ where: { memberId } });
            const deletedBookings = await tx.booking.deleteMany({ where: { memberId } });
            const deletedTrainingSessions = await tx.trainingSession.deleteMany({ where: { memberId } });
            const deletedPayments = await tx.payment.deleteMany({ where: { memberId } });
            const deletedOrders = await tx.order.deleteMany({ where: { memberId } });
            await tx.member.delete({ where: { id: memberId } });

            return {
                deletedAccessLogs: deletedAccessLogs.count,
                deletedBookings: deletedBookings.count,
                deletedMemberNotes: deletedMemberNotes.count,
                deletedMembershipPeriods: deletedMembershipPeriods.count,
                deletedOrderItems: deletedOrderItems.count,
                deletedOrders: deletedOrders.count,
                deletedPaymentItems: deletedPaymentItems.count,
                deletedPaymentMethods: deletedPaymentMethods.count,
                deletedPayments: deletedPayments.count,
                deletedSessionMaterials: deletedSessionMaterials.count,
                deletedTrainingSessions: deletedTrainingSessions.count
            };
        });

        if (!deletedSummary) {
            return res.status(404).json({ error: "Member not found" });
        }

        res.json({ message: "Member and related data deleted successfully", deletedSummary });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete member", detail: e.message });
    }
};

// Get Available Classes (Member View)
const getAvailableClasses = async (req, res) => {
    try {
        const memberId = Number(req.user.id);
        const now = new Date();
        const [member, classes, memberBookings] = await Promise.all([
            prisma.member.findUnique({
                where: { id: memberId },
                include: { plan: true }
            }),
            prisma.class.findMany({
                include: { trainer: true }
            }),
            prisma.booking.findMany({
                where: {
                    memberId,
                    status: { in: BOOKED_STATUSES }
                },
                select: {
                    classId: true,
                    sessionDate: true
                }
            })
        ]);

        if (!member) {
            return res.status(404).json({ error: "Member profile not found" });
        }

        const includedClassSessions = getPlanClassSessions(member.plan);
        const classSessionsPurchased = Number(member.classSessionsPurchased || 0);
        const classSessionsUsed = Number(member.classSessionsUsed || 0);
        const ledgerRemaining = Math.max(0, (includedClassSessions + classSessionsPurchased) - classSessionsUsed);
        const storedRemaining = Number(member.classSessionsRemaining || 0);
        const classSessionsRemaining = Math.max(0, Math.max(storedRemaining, ledgerRemaining));
        if (classSessionsRemaining !== storedRemaining) {
            await prisma.member.update({
                where: { id: memberId },
                data: { classSessionsRemaining }
            });
        }
        const canBookClasses = classSessionsRemaining > 0;

        const bookKeySet = new Set(
            memberBookings
                .filter((booking) => booking.sessionDate)
                .map((booking) => toSessionKey(booking.classId, booking.sessionDate))
        );
        const legacyBookedClassIds = new Set(
            memberBookings
                .filter((booking) => !booking.sessionDate)
                .map((booking) => Number(booking.classId))
        );

        const classRows = await Promise.all(classes.map(async (cls) => {
            const sessionDate = resolveClassSessionStart(cls, {
                now,
                preferToday: false,
                includePastOneTime: false
            });
            if (!sessionDate) return null;

            const enrolled = await prisma.booking.count({
                where: {
                    classId: cls.id,
                    sessionDate,
                    status: 'CONFIRMED'
                }
            });

            const waitlisted = await prisma.booking.count({
                where: {
                    classId: cls.id,
                    sessionDate,
                    status: 'WAITLISTED'
                }
            });

            return {
                ...cls,
                sessionDate,
                enrolled,
                waitlisted,
                isBooked: bookKeySet.has(toSessionKey(cls.id, sessionDate)) || legacyBookedClassIds.has(Number(cls.id))
            };
        }));

        const classesWithBooking = classRows
            .filter(Boolean)
            .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());

        res.json({
            sessionInfo: {
                planName: member.plan?.name || null,
                includedClassSessions,
                classSessionsRemaining,
                classSessionsUsed,
                classSessionsPurchased,
                canBookClasses
            },
            classes: classesWithBooking
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Book a Class
const bookClass = async (req, res) => {
    const { classId, sessionDate: requestedSessionDate } = req.body;
    const memberId = Number(req.user.id);

    // Safety check: Ensure user is a member
    if (req.user.role !== 'MEMBER') return res.status(403).json({ error: "Only members can book classes" });

    try {
        const parsedClassId = Number(classId);
        if (!Number.isInteger(parsedClassId)) {
            return res.status(400).json({ error: "Invalid class ID" });
        }

        const bookingResult = await prisma.$transaction(async (tx) => {
            const now = new Date();
            const [member, cls] = await Promise.all([
                tx.member.findUnique({ where: { id: memberId } }),
                tx.class.findUnique({ where: { id: parsedClassId }, include: { trainer: true } })
            ]);

            if (!member) {
                return { error: "Member profile not found", status: 404 };
            }
            if (!cls) {
                return { error: "Class not found", status: 404 };
            }

            const resolvedSessionDate = resolveClassSessionStart(cls, {
                now,
                requestedSessionDate,
                preferToday: false,
                includePastOneTime: false
            });
            if (!resolvedSessionDate) {
                return { error: "No available session date for this class", status: 400 };
            }
            const sessionBounds = getDayBounds(resolvedSessionDate);
            if (!sessionBounds) {
                return { error: "Invalid class session date", status: 400 };
            }

            const alreadyCompleted = await tx.classHistory.findFirst({
                where: {
                    classId: parsedClassId,
                    date: { gte: sessionBounds.start, lt: sessionBounds.end }
                }
            });
            if (alreadyCompleted) {
                return { error: "This class session is already completed", status: 400 };
            }

            if (Number(member.classSessionsRemaining || 0) <= 0) {
                return {
                    error: "No class sessions remaining. Please purchase a class session package.",
                    status: 400
                };
            }

            const enrolled = await tx.booking.count({
                where: {
                    classId: parsedClassId,
                    sessionDate: resolvedSessionDate,
                    status: { in: ACTIVE_OCCUPANCY_STATUSES }
                }
            });

            const alreadyBooked = await tx.booking.findFirst({
                where: {
                    memberId,
                    classId: parsedClassId,
                    sessionDate: resolvedSessionDate,
                    status: { in: BOOKED_STATUSES }
                }
            });

            if (alreadyBooked) {
                return { error: `You are already ${alreadyBooked.status.toLowerCase()} for this session.`, status: 400 };
            }

            const isWaitlist = enrolled >= cls.capacity;
            const status = isWaitlist ? 'WAITLISTED' : 'CONFIRMED';

            await tx.booking.create({
                data: {
                    memberId,
                    classId: parsedClassId,
                    sessionDate: resolvedSessionDate,
                    status
                }
            });

            if (status === 'CONFIRMED') {
                await tx.member.update({
                    where: { id: memberId },
                    data: {
                        classSessionsRemaining: { decrement: 1 },
                        classSessionsUsed: { increment: 1 }
                    }
                });
            }

            // Notification
            const isToday = resolvedSessionDate.toDateString() === new Date().toDateString();
            const dayLabel = isToday ? 'Today' : 'Tomorrow';

            await notificationService.send({
                memberId,
                title: isWaitlist ? 'Waitlist Joined' : 'Booking Confirmed',
                message: isWaitlist 
                    ? `You've been added to the waitlist for ${cls.name}.` 
                    : `Your spot for ${cls.name} on ${resolvedSessionDate.toLocaleDateString()} is confirmed!`,
                type: isWaitlist ? 'WAITLIST_JOINED' : 'BOOKING_CONFIRMED',
                eventData: {
                    className: cls.name,
                    trainerName: cls.trainer?.name || 'Staff',
                    sessionDate: resolvedSessionDate.toLocaleDateString(),
                    time: cls.time,
                    dayLabel,
                    status
                }
            });

            return { success: true, isWaitlist };
        });

        if (!bookingResult.success) {
            return res.status(bookingResult.status || 400).json({ error: bookingResult.error || "Booking failed" });
        }

        res.json({ 
            message: bookingResult.isWaitlist ? "Added to waitlist" : "Booking confirmed",
            isWaitlist: bookingResult.isWaitlist 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Cancel Booking
const cancelBooking = async (req, res) => {
    const { classId, sessionDate: requestedSessionDate } = req.body;
    const memberId = Number(req.user.id);

    try {
        const parsedClassId = Number(classId);
        if (!Number.isInteger(parsedClassId)) {
            return res.status(400).json({ error: "Invalid class ID" });
        }

        const cancelResult = await prisma.$transaction(async (tx) => {
            const cls = await tx.class.findUnique({ where: { id: parsedClassId } });
            if (!cls) {
                return { error: "Class not found", status: 404 };
            }

            const resolvedSessionDate = requestedSessionDate
                ? resolveClassSessionStart(cls, {
                    now: new Date(),
                    requestedSessionDate,
                    includePastOneTime: true
                })
                : null;
            if (requestedSessionDate && !resolvedSessionDate) {
                return { error: "Invalid session date for this class", status: 400 };
            }

            const booking = await tx.booking.findFirst({
                where: resolvedSessionDate
                    ? {
                        memberId,
                        classId: parsedClassId,
                        status: { in: BOOKED_STATUSES },
                        OR: [
                            { sessionDate: resolvedSessionDate },
                            { sessionDate: null }
                        ]
                    }
                    : {
                        memberId,
                        classId: parsedClassId,
                        status: { in: BOOKED_STATUSES }
                    },
                orderBy: { sessionDate: 'asc' }
            });

            if (!booking) {
                return { error: "Booking found, but it cannot be cancelled (maybe already attended or cancelled).", status: 404 };
            }

            const oldStatus = booking.status;
            await tx.booking.update({
                where: { id: booking.id },
                data: { status: 'CANCELLED' }
            });

            // Business rule: once a class booking is joined/confirmed, the session stays consumed
            // even when member cancels/leaves later. Do not restore class session counters here.

            // If a confirmed spot was cancelled, promote someone from waitlist
            if (oldStatus === 'CONFIRMED') {
                    // Find the first waitlisted member who has sessions left
                    let memberToPromote = null;
                    const waitlistedBookings = await tx.booking.findMany({
                        where: {
                            classId: parsedClassId,
                            sessionDate: booking.sessionDate,
                            status: 'WAITLISTED'
                        },
                        include: { member: true },
                        orderBy: { createdAt: 'asc' }
                    });

                    for (const wb of waitlistedBookings) {
                        if (wb.member && wb.member.classSessionsRemaining > 0) {
                            memberToPromote = wb;
                            break;
                        }
                    }

                    if (memberToPromote) {
                        await tx.booking.update({
                            where: { id: memberToPromote.id },
                            data: { status: 'CONFIRMED' }
                        });

                        // Deduct session from the promoted member
                        await tx.member.update({
                            where: { id: memberToPromote.memberId },
                            data: {
                                classSessionsRemaining: { decrement: 1 },
                                classSessionsUsed: { increment: 1 }
                            }
                        });

                        // Trigger notification for waitlist promotion
                        await notificationService.send({
                            memberId: memberToPromote.memberId,
                            title: 'Waitlist Promotion! 🚀',
                            message: `Good news! You've been promoted from the waitlist for ${cls.name}.`,
                            type: 'WAITLIST_PROMOTION',
                            eventData: {
                                className: cls.name,
                                sessionDate: booking.sessionDate.toLocaleDateString(),
                                dayLabel: 'Upcoming' // Fallback label
                            }
                        });
                    }
            }

            return { success: true };
        });

        if (!cancelResult.success) {
            return res.status(cancelResult.status || 400).json({ error: cancelResult.error || "Cancellation failed" });
        }

        res.json({ message: "Booking cancelled. Session remains consumed." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const checkBookingConflictWithClient = async (dbClient, trainerId, startDateTime, durationMinutes) => {
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

    const startOfDay = new Date(startDateTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const conflictingSessions = await dbClient.trainingSession.findMany({
        where: {
            trainerId: Number(trainerId),
            date: {
                gte: startOfDay,
                lt: endOfDay
            },
            status: { notIn: FINALIZED_SESSION_STATUSES }
        }
    });

    return conflictingSessions.some(session => {
        const sessionStart = new Date(session.date);
        const sessionEnd = new Date(sessionStart.getTime() + session.duration * 60000);
        return startDateTime < sessionEnd && endDateTime > sessionStart;
    });
};

const shouldTemporarilyOpenTrainerForDate = async ({ trainerId, date, now = new Date() }) => {
    const requestedIso = String(date || '').trim();
    const todayIso = toLocalIsoDate(now);
    if (!requestedIso || !todayIso || requestedIso !== todayIso) return false;

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const session = await prisma.trainingSession.findFirst({
        where: {
            trainerId: Number(trainerId),
            date: {
                gte: now,
                lte: endOfDay
            },
            status: { notIn: FINALIZED_SESSION_STATUSES }
        },
        select: { id: true }
    });

    return Boolean(session);
};

const appendBookingBatchNote = (notes, bookingBatchId) => {
    const normalizedBatchId = String(bookingBatchId || '').trim();
    if (!normalizedBatchId) return notes || null;
    const line = `BOOKING_BATCH_ID=${normalizedBatchId}`;
    return [String(notes || '').trim(), line].filter(Boolean).join('\n');
};

const parseTrainingBookingSlots = ({ date, time, slots }) => {
    const rawSlots = Array.isArray(slots) && slots.length > 0
        ? slots
        : [{ date, time }];

    if (!rawSlots.length) {
        return { error: 'At least one schedule slot is required.' };
    }

    const seen = new Set();
    const now = new Date();
    const normalized = [];

    for (const slot of rawSlots) {
        const slotDate = String(slot?.date || '').trim();
        const slotTime = String(slot?.time || '').trim();
        if (!slotDate || !slotTime) {
            return { error: 'Each slot must include date and time.' };
        }

        const slotKey = `${slotDate}T${slotTime}`;
        if (seen.has(slotKey)) {
            return { error: 'Duplicate schedule slots are not allowed.' };
        }
        seen.add(slotKey);

        const startDateTime = new Date(slotKey);
        if (Number.isNaN(startDateTime.getTime())) {
            return { error: `Invalid slot datetime: ${slotKey}` };
        }
        if (startDateTime <= now) {
            return { error: `Slot must be in the future: ${slotKey}` };
        }

        normalized.push({
            date: slotDate,
            time: slotTime,
            startDateTime
        });
    }

    normalized.sort((left, right) => left.startDateTime.getTime() - right.startDateTime.getTime());
    return { slots: normalized };
};

const mapSavedPaymentMethodToSessionMethod = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (['GCASH', 'MAYA', 'PAYMAYA'].includes(normalized)) {
        return normalized === 'PAYMAYA' ? 'MAYA' : normalized;
    }
    if (normalized === 'BANK_TRANSFER') return 'BANK_TRANSFER';
    return 'CARD';
};

const createHttpError = (status, message, detail = null) => {
    const error = new Error(message);
    error.status = status;
    if (detail) error.detail = detail;
    return error;
};

const bookTrainingSlots = async ({
    memberId,
    trainer,
    duration,
    notes,
    bookingBatchId,
    slots,
    paymentMethod,
    createPaymentRecord
}) => {
    const numericMemberId = Number(memberId);
    const numericTrainerId = Number(trainer.id);
    const numericDuration = Number(duration);
    const sessionRate = Number(trainer.sessionPrice ?? 300);
    const totalPerSession = (numericDuration / 60) * sessionRate;
    const isCash = String(paymentMethod).toUpperCase() === 'CASH';

    const createdSessions = [];

    await prisma.$transaction(async (tx) => {
        for (const slot of slots) {
            if (await checkBookingConflictWithClient(tx, numericTrainerId, slot.startDateTime, numericDuration)) {
                throw createHttpError(409, 'This time slot is already booked by another member', slot.startDateTime.toISOString());
            }

            const createdSession = await tx.trainingSession.create({
                data: {
                    memberId: numericMemberId,
                    trainerId: numericTrainerId,
                    date: slot.startDateTime,
                    duration: numericDuration,
                    price: totalPerSession,
                    status: 'SCHEDULED',
                    paymentStatus: isCash ? 'UNPAID' : 'PAID',
                    paymentMethod,
                    paidAt: isCash ? null : new Date(),
                    notes: appendBookingBatchNote(notes, bookingBatchId)
                }
            });

            if (!isCash && createPaymentRecord) {
                await createPaymentCompat(tx, {
                    amount: totalPerSession,
                    type: 'TRAINING',
                    method: paymentMethod,
                    status: 'COMPLETED',
                    memberId: numericMemberId
                });
            }

            createdSessions.push(createdSession);
        }
    });

    return {
        createdSessions,
        totalAmount: totalPerSession * slots.length
    };
};

const recomputeTrainerRating = async (tx, trainerId) => {
    const aggregate = await tx.trainingSession.aggregate({
        where: {
            trainerId: Number(trainerId),
            memberRating: { not: null },
            memberRatingVoided: false
        },
        _avg: { memberRating: true },
        _count: { memberRating: true }
    });

    const average = Number(aggregate?._avg?.memberRating || 0);
    const rating = Number.isFinite(average) ? Number(average.toFixed(2)) : 0;
    const ratingCount = Number(aggregate?._count?.memberRating || 0);

    await tx.trainer.update({
        where: { id: Number(trainerId) },
        data: { rating }
    });

    return { rating, ratingCount };
};

const normalizeTrainerRating = (trainer) => {
    if (!trainer) return trainer;
    const numeric = Number(trainer.rating);
    return {
        ...trainer,
        rating: Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0
    };
};

// Book a Trainer Session (Member)
const bookTraining = async (req, res) => {
    const { trainerId, date, time, duration, notes, method, bookingBatchId, slots, paymentMethodId } = req.body;
    const memberId = req.user.id;

    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can book trainer sessions from this endpoint" });
    }

    const normalizedMethod = String(method || 'CASH').trim().toUpperCase();

    try {
        const parsedSlots = parseTrainingBookingSlots({ date, time, slots });
        if (parsedSlots.error) {
            return res.status(400).json({ error: parsedSlots.error });
        }

        const member = await prisma.member.findUnique({ where: { id: Number(memberId) } });
        if (!member) {
            return res.status(404).json({ error: "Member profile not found. Please log in again as a member." });
        }

        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        const allowedDurations = (trainer.sessionDurations || '60')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
        const numericDuration = Number(duration);
        if (!allowedDurations.includes(numericDuration)) {
            return res.status(400).json({ error: "Selected duration not available" });
        }

        for (const slot of parsedSlots.slots) {
            const allowClosedBookingToday = await shouldTemporarilyOpenTrainerForDate({
                trainerId: Number(trainerId),
                date: slot.date
            });
            if (!(await isTimeAllowedForTrainer({
                trainerId: Number(trainerId),
                date: slot.date,
                time: slot.time,
                duration: numericDuration,
                enforceBookingStatus: !allowClosedBookingToday
            }))) {
                return res.status(400).json({
                    error: `Selected schedule is outside trainer availability (${slot.date} ${slot.time})`
                });
            }
        }

        const validBaseMethods = (PAYMENT_METHODS || []).map(m => String(m.value).toUpperCase());
        const allowedMethods = [...new Set([...validBaseMethods, 'CARD', 'CASH', 'GCASH', 'MAYA', 'PAYMAYA', 'BANK_TRANSFER'])];
        if (!allowedMethods.includes(normalizedMethod)) {
            return res.status(400).json({ error: "Invalid payment method" });
        }

        let resolvedPaymentMethod = normalizedMethod;
        if (normalizedMethod !== 'CASH') {
            const parsedPaymentMethodId = Number(paymentMethodId);
            if (!Number.isInteger(parsedPaymentMethodId)) {
                return res.status(400).json({ error: "Please select a saved payment method." });
            }

            const savedMethod = await prisma.paymentMethod.findFirst({
                where: {
                    id: parsedPaymentMethodId,
                    memberId: Number(memberId)
                },
                select: { id: true, type: true }
            });
            if (!savedMethod) {
                return res.status(400).json({ error: "Selected payment method is invalid." });
            }

            resolvedPaymentMethod = mapSavedPaymentMethodToSessionMethod(savedMethod.type);
        }

        const { createdSessions, totalAmount } = await bookTrainingSlots({
            memberId,
            trainer,
            duration: numericDuration,
            notes,
            bookingBatchId,
            slots: parsedSlots.slots,
            paymentMethod: resolvedPaymentMethod,
            createPaymentRecord: true
        });

        // Immediate Notification
        for (const session of createdSessions) {
            const sessionDate = new Date(session.date);
            const isToday = sessionDate.toDateString() === new Date().toDateString();
            const dayLabel = isToday ? 'Today' : 'Tomorrow';

            await notificationService.send({
                memberId,
                title: 'Training Confirmed 💪',
                message: `Your session with Coach ${trainer.name} on ${sessionDate.toLocaleDateString()} at ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} is confirmed!`,
                type: 'TRAINING_BOOKED',
                eventData: {
                    trainerName: trainer.name,
                    date: sessionDate.toLocaleDateString(),
                    time: sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    dayLabel,
                    status: 'SCHEDULED'
                }
            });
        }

        res.json({
            message: resolvedPaymentMethod === 'CASH'
                ? "Training session booked. Pay at the front desk."
                : "Training session booked and paid",
            bookedCount: createdSessions.length,
            totalAmount,
            sessionDates: createdSessions.map((session) => session.date),
            session: {
                trainerName: trainer.name,
                date: createdSessions[0]?.date || null,
                totalAmount,
                paymentMethod: resolvedPaymentMethod
            }
        });
    } catch (e) {
        if (Number.isInteger(e?.status) && e.status >= 400 && e.status < 500) {
            return res.status(e.status).json({
                error: e.message || 'Booking failed',
                ...(e.detail ? { detail: e.detail } : {})
            });
        }
        res.status(500).json({ error: "Failed to book training session", detail: e?.message });
    }
};

// Book a Trainer Session (Cash, Unpaid) - Authenticated members only
const bookTrainingCash = async (req, res) => {
    const { trainerId, date, time, duration, notes, bookingBatchId, slots } = req.body;
    const resolvedMemberId = req.user.id;

    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can book trainer sessions from this endpoint" });
    }

    if (!trainerId || !duration) {
        return res.status(400).json({ error: "Missing required booking details" });
    }

    try {
        const parsedSlots = parseTrainingBookingSlots({ date, time, slots });
        if (parsedSlots.error) {
            return res.status(400).json({ error: parsedSlots.error });
        }

        const member = await prisma.member.findUnique({ where: { id: Number(resolvedMemberId) } });
        if (!member) {
            return res.status(404).json({ error: "Member profile not found. Please log in again as a member." });
        }

        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        const allowedDurations = (trainer.sessionDurations || '60')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
        const numericDuration = Number(duration);
        if (!allowedDurations.includes(numericDuration)) {
            return res.status(400).json({ error: "Selected duration not available" });
        }

        for (const slot of parsedSlots.slots) {
            const allowClosedBookingToday = await shouldTemporarilyOpenTrainerForDate({
                trainerId: Number(trainerId),
                date: slot.date
            });
            if (!(await isTimeAllowedForTrainer({
                trainerId: Number(trainerId),
                date: slot.date,
                time: slot.time,
                duration: numericDuration,
                enforceBookingStatus: !allowClosedBookingToday
            }))) {
                return res.status(400).json({
                    error: `Selected schedule is outside trainer availability (${slot.date} ${slot.time})`
                });
            }
        }

        const { createdSessions } = await bookTrainingSlots({
            memberId: resolvedMemberId,
            trainer,
            duration: numericDuration,
            notes,
            bookingBatchId,
            slots: parsedSlots.slots,
            paymentMethod: 'CASH',
            createPaymentRecord: false
        });

        // Immediate Notification
        for (const session of createdSessions) {
            const sessionDate = new Date(session.date);
            const isToday = sessionDate.toDateString() === new Date().toDateString();
            const dayLabel = isToday ? 'Today' : 'Tomorrow';

            await notificationService.send({
                memberId: resolvedMemberId,
                title: 'Training Requested ⏳',
                message: `Your session with Coach ${trainer.name} on ${sessionDate.toLocaleDateString()} at ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} is pending payment at the front desk.`,
                type: 'TRAINING_BOOKED',
                eventData: {
                    trainerName: trainer.name,
                    date: sessionDate.toLocaleDateString(),
                    time: sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    dayLabel,
                    status: 'UNPAID'
                }
            });
        }

        res.json({
            message: "Training session booked. Pay at the front desk.",
            bookedCount: createdSessions.length,
            sessionDates: createdSessions.map((session) => session.date)
        });
    } catch (e) {
        if (Number.isInteger(e?.status) && e.status >= 400 && e.status < 500) {
            return res.status(e.status).json({
                error: e.message || 'Booking failed',
                ...(e.detail ? { detail: e.detail } : {})
            });
        }
        res.status(500).json({ error: "Failed to book training session", detail: e?.message });
    }
};

// Members can see their own profile; Staff/Admin can see any
const getMemberProfile = async (req, res) => {
    const { id } = req.params;

    // Authorization check
    if (req.user.role === 'MEMBER' && req.user.id !== Number(id)) {
        return res.sendStatus(403);
    }

    try {
        const member = await prisma.member.findUnique({
            where: { id: Number(id) },
            include: { plan: true, payments: { orderBy: { date: 'desc' } }, accessLogs: { orderBy: { checkIn: 'desc' }, take: 20 }, membershipPeriods: { include: { plan: true }, orderBy: { startDate: 'desc' } } }
        });
        if (!member) return res.status(404).json({ error: "Member not found" });
        res.json(member);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const getMyTrainingSessions = async (req, res) => {
    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can access this endpoint" });
    }

    try {
        const sessions = await prisma.trainingSession.findMany({
            where: { memberId: Number(req.user.id) },
            include: {
                trainer: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        imageUrl: true,
                        rating: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });
        const normalizedSessions = sessions.map((session) => ({
            ...session,
            trainer: normalizeTrainerRating(session.trainer)
        }));
        res.json(normalizedSessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions", detail: e?.message });
    }
};

const getMyClassBookings = async (req, res) => {
    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can access this endpoint" });
    }

    try {
        const bookings = await prisma.booking.findMany({
            where: { memberId: Number(req.user.id) },
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                        dayOfWeek: true,
                        time: true,
                        duration: true,
                        scheduleType: true,
                        oneTimeDate: true,
                        trainer: {
                            select: {
                                id: true,
                                name: true,
                                specialization: true,
                                imageUrl: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { sessionDate: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        res.json(bookings);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch class bookings", detail: e?.message });
    }
};

const rateTrainingSession = async (req, res) => {
    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can access this endpoint" });
    }

    const sessionId = Number(req.params.id);
    const rawRating = Number(req.body?.rating);
    const rawComment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    const normalizedComment = rawComment.length > 0 ? rawComment.slice(0, RATING_COMMENT_MAX_LENGTH) : null;

    if (!Number.isInteger(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
    }
    if (!Number.isInteger(rawRating) || rawRating < RATING_MIN || rawRating > RATING_MAX) {
        return res.status(400).json({ error: `Rating must be an integer between ${RATING_MIN} and ${RATING_MAX}` });
    }
    if (rawComment.length > RATING_COMMENT_MAX_LENGTH) {
        return res.status(400).json({ error: `Comment must not exceed ${RATING_COMMENT_MAX_LENGTH} characters` });
    }

    try {
        const session = await prisma.trainingSession.findFirst({
            where: {
                id: sessionId,
                memberId: Number(req.user.id)
            },
            select: {
                id: true,
                trainerId: true,
                status: true,
                memberRating: true,
                memberRatingVoided: true,
                trainer: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!session) {
            return res.status(404).json({ error: "Training session not found" });
        }
        if (String(session.status).toUpperCase() !== 'COMPLETED') {
            return res.status(400).json({ error: "Only completed sessions can be rated" });
        }
        if (session.memberRatingVoided) {
            return res.status(400).json({ error: "This session rating was skipped and cannot be rated anymore." });
        }
        if (session.memberRating !== null && session.memberRating !== undefined) {
            return res.status(400).json({ error: "This session has already been rated" });
        }

        const result = await prisma.$transaction(async (tx) => {
            await tx.trainingSession.update({
                where: { id: sessionId },
                data: {
                    memberRating: rawRating,
                    memberRatingComment: normalizedComment,
                    memberRatingVoided: false,
                    memberRatingVoidedAt: null,
                    memberRatedAt: new Date()
                }
            });

            const trainerRating = await recomputeTrainerRating(tx, session.trainerId);
            return trainerRating;
        });

        return res.json({
            message: "Session rated successfully",
            sessionId,
            trainerId: session.trainerId,
            trainerName: session.trainer?.name || `Trainer #${session.trainerId}`,
            ratingGiven: rawRating,
            comment: normalizedComment,
            trainerRating: result.rating,
            trainerRatingCount: result.ratingCount
        });
    } catch (e) {
        return res.status(500).json({ error: "Failed to submit rating", detail: e?.message });
    }
};

const voidTrainingSessionRating = async (req, res) => {
    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can access this endpoint" });
    }

    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
    }

    try {
        const session = await prisma.trainingSession.findFirst({
            where: {
                id: sessionId,
                memberId: Number(req.user.id)
            },
            select: {
                id: true,
                trainerId: true,
                status: true,
                memberRating: true,
                memberRatingVoided: true,
                trainer: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!session) {
            return res.status(404).json({ error: "Training session not found" });
        }
        if (String(session.status).toUpperCase() !== 'COMPLETED') {
            return res.status(400).json({ error: "Only completed sessions can be skipped" });
        }
        if (session.memberRating !== null && session.memberRating !== undefined) {
            return res.status(400).json({ error: "This session has already been rated and cannot be skipped" });
        }
        if (session.memberRatingVoided) {
            return res.json({
                message: "Session rating is already skipped",
                sessionId,
                trainerId: session.trainerId,
                trainerName: session.trainer?.name || `Trainer #${session.trainerId}`
            });
        }

        await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                memberRating: null,
                memberRatingComment: null,
                memberRatingVoided: true,
                memberRatingVoidedAt: new Date(),
                memberRatedAt: null
            }
        });

        return res.json({
            message: "Rating skipped for this session",
            sessionId,
            trainerId: session.trainerId,
            trainerName: session.trainer?.name || `Trainer #${session.trainerId}`
        });
    } catch (e) {
        return res.status(500).json({ error: "Failed to skip rating", detail: e?.message });
    }
};

// Member Payment Methods
const toClientPaymentMethod = (method) => {
    const rawType = String(method?.type || '').toUpperCase();
    const normalizedType = rawType === 'GCASH' || rawType === 'PAYMAYA'
        ? rawType
        : 'CARD';
    const expiry = String(method?.expiry || '');
    const [expMonth = '', expYear = ''] = expiry.includes('/') ? expiry.split('/') : ['', ''];
    const walletLabel = normalizedType === 'PAYMAYA' ? 'Maya Wallet' : 'GCash Wallet';
    const walletName = normalizedType === 'PAYMAYA' ? 'Maya Wallet' : 'GCash Wallet';

    return {
        ...method,
        type: normalizedType,
        label: normalizedType === 'GCASH' || normalizedType === 'PAYMAYA'
            ? walletLabel
            : `${method?.brand || 'Card'} Card`,
        name: normalizedType === 'GCASH' || normalizedType === 'PAYMAYA' ? walletName : (method?.brand || 'Card'),
        phone: normalizedType === 'GCASH' || normalizedType === 'PAYMAYA' ? `****${method?.last4 || ''}` : null,
        expMonth,
        expYear
    };
};

const getPaymentMethods = async (req, res) => {
    const memberId = Number(req.params.id);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    try {
        const methods = await prisma.paymentMethod.findMany({
            where: { memberId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(methods.map(toClientPaymentMethod));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const addPaymentMethod = async (req, res) => {
    const memberId = Number(req.params.id);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    const { type, phone, brand, last4, expMonth, expYear, expiry, isDefault } = req.body;
    const normalizedType = String(type || '').toUpperCase();
    if (!['GCASH', 'PAYMAYA', 'CARD'].includes(normalizedType)) return res.status(400).json({ error: "Invalid payment method type" });

    try {
        const existingCount = await prisma.paymentMethod.count({ where: { memberId } });
        const makeDefault = Boolean(isDefault) || existingCount === 0;

        const phoneDigits = String(phone || '').replace(/\D/g, '');
        const cardDigits = String(last4 || '').replace(/\D/g, '');
        const computedLast4 = (normalizedType === 'GCASH' || normalizedType === 'MAYA')
            ? phoneDigits.slice(-4)
            : cardDigits.slice(-4);
        if (!computedLast4 || computedLast4.length !== 4) {
            return res.status(400).json({ error: "A valid 4-digit tail is required" });
        }

        let computedExpiry = String(expiry || '').trim();
        if (!computedExpiry && (expMonth || expYear)) {
            computedExpiry = `${String(expMonth || '').trim()}/${String(expYear || '').trim()}`;
        }
        if (normalizedType === 'CARD' && !computedExpiry) {
            return res.status(400).json({ error: "Card expiry is required" });
        }

        const method = await prisma.$transaction(async (tx) => {
            if (makeDefault) {
                await tx.paymentMethod.updateMany({
                    where: { memberId },
                    data: { isDefault: false }
                });
            }
            return tx.paymentMethod.create({
                data: {
                    memberId,
                    type: normalizedType,
                    brand: normalizedType === 'CARD' ? (brand || 'Card') : normalizedType,
                    last4: computedLast4,
                    expiry: computedExpiry || null,
                    token: `pm_${Math.random().toString(36).slice(2, 14)}`,
                    isDefault: makeDefault
                }
            });
        });

        res.json(toClientPaymentMethod(method));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updatePaymentMethod = async (req, res) => {
    const memberId = Number(req.params.id);
    const methodId = Number(req.params.methodId);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    const { isDefault } = req.body;
    try {
        const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
        if (!method || method.memberId !== memberId) return res.status(404).json({ error: "Payment method not found" });

        if (isDefault) {
            await prisma.$transaction([
                prisma.paymentMethod.updateMany({ where: { memberId }, data: { isDefault: false } }),
                prisma.paymentMethod.update({ where: { id: methodId }, data: { isDefault: true } })
            ]);
            const updated = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
            return res.json(toClientPaymentMethod(updated));
        }
        res.json(toClientPaymentMethod(method));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const deletePaymentMethod = async (req, res) => {
    const memberId = Number(req.params.id);
    const methodId = Number(req.params.methodId);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    try {
        const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
        if (!method || method.memberId !== memberId) return res.status(404).json({ error: "Payment method not found" });

        await prisma.paymentMethod.delete({ where: { id: methodId } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const bcrypt = require('bcryptjs'); // Need bcrypt for password change

// Only Staff/Admin can create members
const createMember = async (req, res) => {
    const { firstName, lastName, email, phone, planId, imageUrl, birthDate, sex, paymentMethod, cashTendered, changeDue, gcashReference, gcashDate, gcashTime } = req.body;
    try {
        if (!firstName || !lastName || !planId || !paymentMethod) {
            return res.status(400).json({ error: "firstName, lastName, planId, and paymentMethod are required" });
        }
        const { PAYMENT_METHODS } = require('../../config/businessConfig');
        const normalizedMethod = String(paymentMethod || 'CASH').trim().toUpperCase();
        const validBaseMethods = (PAYMENT_METHODS || []).map(m => String(m.value).toUpperCase());
        const allowedMethods = [...new Set([...validBaseMethods, 'CARD', 'CASH', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER'])];

        if (!allowedMethods.includes(normalizedMethod)) {
            return res.status(400).json({ error: "Invalid payment method" });
        }

        // Calculate expiry based on plan
        const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
        if (!plan) return res.status(404).json({ error: "Plan not found" });
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(startDate.getDate() + (plan ? plan.duration : 30));

        const method = String(paymentMethod).toUpperCase();
        const normalizedCashTendered = method === 'CASH'
            ? Number(cashTendered)
            : null;
        if (method === 'CASH' && (!Number.isFinite(normalizedCashTendered) || normalizedCashTendered < Number(plan.price))) {
            return res.status(400).json({ error: "Cash tendered must be provided and cover full membership amount" });
        }
        const normalizedChangeDue = method === 'CASH'
            ? (changeDue !== undefined ? Number(changeDue) : (normalizedCashTendered - Number(plan.price)))
            : null;
        if (method === 'CASH' && !Number.isFinite(normalizedChangeDue)) {
            return res.status(400).json({ error: "Invalid change due" });
        }
        if (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) && !gcashReference) {
            return res.status(400).json({ error: `${method} reference is required for e-wallet payments` });
        }

        const { member: createdMemberData, payment, activationToken, activationEmail, activationName, planName, expiryDate: calculatedExpiry } = await prisma.$transaction(async (tx) => {
            const activationToken = crypto.randomBytes(16).toString('hex');
            const activationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            const createdMember = await tx.member.create({
                data: {
                    firstName, lastName, email, phone, planId: Number(planId),
                    imageUrl,
                    birthDate: birthDate ? new Date(birthDate) : null,
                    sex,
                    status: 'PENDING_ACTIVATION',
                    startDate,
                    expiryDate,
                    activationToken,
                    activationExpires
                }
            });

            await applyPlanClassSessions({ tx, memberId: createdMember.id, plan });

            const pointsAwarded = Math.floor(plan.price / 100);
            const externalDate = (gcashDate && gcashTime) ? new Date(`${gcashDate}T${gcashTime}`) : null;
            const createdPayment = await tx.payment.create({
                data: {
                    amount: plan.price,
                    type: 'MEMBERSHIP',
                    method,
                    status: 'COMPLETED',
                    memberId: createdMember.id,
                    cashierId: req.user.id,
                    pointsAwarded,
                    cashTendered: method === 'CASH' ? normalizedCashTendered : null,
                    changeDue: method === 'CASH' ? normalizedChangeDue : null,
                    externalRef: ['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) ? (gcashReference || null) : null,
                    externalDate: (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) && externalDate) ? externalDate : null
                }
            });

            await tx.paymentItem.create({
                data: {
                    paymentId: createdPayment.id,
                    productId: null,
                    name: plan.name,
                    type: 'PLAN',
                    quantity: 1,
                    unitPrice: plan.price
                }
            });

            if (pointsAwarded > 0) {
                await tx.member.update({
                    where: { id: createdMember.id },
                    data: { points: { increment: pointsAwarded } }
                });
            }

            const hydratedMember = await tx.member.findUnique({
                where: { id: createdMember.id },
                include: { plan: true }
            });

            return {
                member: hydratedMember || createdMember,
                payment: createdPayment,
                activationToken,
                activationEmail: email,
                activationName: `${firstName} ${lastName}`,
                planName: plan.name,
                expiryDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000).toLocaleDateString()
            };
        });

        // Send activation email OUTSIDE the transaction to avoid stalling the DB connection
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
        const activationLink = `${frontendUrl}/activate?token=${(activationToken || '').trim()}`;
        console.log(`[Member Created] Activation link for ${activationName}: ${activationLink}`);

        try {
            await sendActivationEmail(
                activationEmail || email,
                activationName || `${firstName} ${lastName}`,
                activationToken,
                planName || 'Gym Plan',
                calculatedExpiry,
                createdMemberData.phone || 'N/A',
                createdMemberData.birthDate ? new Date(createdMemberData.birthDate).toLocaleDateString() : 'N/A',
                createdMemberData.sex || 'N/A'
            );
        } catch (err) {
            console.error("Failed to send activation email:", err.message);
            console.warn(`[Fallback] Staff can manually share this activation link: ${activationLink}`);
        }

        res.json({ member: createdMemberData, payment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Only Staff/Admin can renew members
const renewMembership = async (req, res) => {
    const { id } = req.params;
    const { duration, amount, method, planId, cashTendered, changeDue, gcashReference, gcashDate, gcashTime } = req.body; // duration in days
    try {
        const normalizedDuration = Number(duration);
        const normalizedAmount = Number(amount);
        const normalizedMethod = String(method || '').toUpperCase();
        if (!Number.isInteger(normalizedDuration) || normalizedDuration <= 0 || normalizedDuration > 366) {
            return res.status(400).json({ error: "Duration must be a whole number of days between 1 and 366" });
        }
        if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
            return res.status(400).json({ error: "Amount must be greater than zero" });
        }
        if (!['CASH', 'CARD', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER'].includes(normalizedMethod)) {
            return res.status(400).json({ error: "Invalid payment method" });
        }

        const normalizedCashTendered = normalizedMethod === 'CASH'
            ? Number(cashTendered)
            : null;
        if (normalizedMethod === 'CASH' && (!Number.isFinite(normalizedCashTendered) || normalizedCashTendered < normalizedAmount)) {
            return res.status(400).json({ error: "Cash tendered must be provided and cover full renewal amount" });
        }
        const normalizedChangeDue = normalizedMethod === 'CASH'
            ? (changeDue !== undefined ? Number(changeDue) : (normalizedCashTendered - normalizedAmount))
            : null;
        if (normalizedMethod === 'CASH' && !Number.isFinite(normalizedChangeDue)) {
            return res.status(400).json({ error: "Invalid change due" });
        }
        if (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(normalizedMethod) && !gcashReference) {
            return res.status(400).json({ error: `${normalizedMethod} reference is required for e-wallet renewals` });
        }

        const member = await prisma.member.findUnique({ where: { id: Number(id) } });
        if (!member) return res.status(404).json({ error: "Member not found" });
        const selectedPlanId = planId ? Number(planId) : member.planId;
        const selectedPlan = selectedPlanId
            ? await prisma.plan.findUnique({ where: { id: selectedPlanId } })
            : null;

        const now = new Date();
        const currentExpiry = member.expiryDate && new Date(member.expiryDate) > now ? new Date(member.expiryDate) : now;
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + normalizedDuration);

        const existingPeriods = await prisma.membershipPeriod.count({
            where: { memberId: Number(id) }
        });

        if (existingPeriods === 0 && member.planId && member.startDate && member.expiryDate) {
            await prisma.membershipPeriod.create({
                data: {
                    memberId: Number(id),
                    planId: member.planId,
                    startDate: member.startDate,
                    endDate: member.expiryDate
                }
            });
        }

        let activationToken = null;
        let isActivating = false;
        const updateData = {
            expiryDate: newExpiry,
            status: 'ACTIVE',
            ...(planId ? { planId: Number(planId) } : {}),
            ...(getPlanClassSessions(selectedPlan) > 0
                ? { classSessionsRemaining: { increment: getPlanClassSessions(selectedPlan) } }
                : {})
        };

        if (member.status === 'WAITLIST') {
            isActivating = true;
            activationToken = crypto.randomBytes(16).toString('hex');
            updateData.activationToken = activationToken;
            updateData.activationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            updateData.status = 'PENDING_ACTIVATION';
        }

        const updatedMember = await prisma.member.update({
            where: { id: Number(id) },
            data: updateData
        });

        await prisma.membershipPeriod.create({
            data: {
                memberId: Number(id),
                planId: selectedPlanId,
                startDate: currentExpiry,
                endDate: newExpiry,
                amount: amount !== undefined && amount !== null ? parseFloat(amount) : null,
                method: normalizedMethod || null
            }
        });

        const externalDate = (gcashDate && gcashTime) ? new Date(`${gcashDate}T${gcashTime}`) : null;
        const pointsAwarded = Math.floor(normalizedAmount / 100);

        const payment = await prisma.payment.create({
            data: {
                amount: normalizedAmount,
                type: 'MEMBERSHIP',
                method: normalizedMethod,
                status: 'COMPLETED',
                memberId: Number(id),
                cashierId: req.user.id,
                pointsAwarded,
                cashTendered: normalizedMethod === 'CASH' ? normalizedCashTendered : null,
                changeDue: normalizedMethod === 'CASH' ? normalizedChangeDue : null,
                externalRef: ['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(normalizedMethod) ? (gcashReference || null) : null,
                externalDate: (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(normalizedMethod) && externalDate) ? externalDate : null
            }
        });

        let planName = 'Membership Renewal';
        if (selectedPlan?.name) {
            planName = selectedPlan.name;
        }

        await prisma.paymentItem.create({
            data: {
                paymentId: payment.id,
                productId: null,
                name: planName,
                type: 'PLAN',
                quantity: 1,
                unitPrice: normalizedAmount
            }
        });

        if (pointsAwarded > 0) {
            await prisma.member.update({
                where: { id: Number(id) },
                data: { points: { increment: pointsAwarded } }
            });
        }

        if (isActivating && activationToken) {
            try {
                // Format the expiry date to be human readable (e.g., YYYY-MM-DD or MM/DD/YYYY)
                const formattedExpiry = newExpiry.toLocaleDateString();
                await sendActivationEmail(member.email, `${member.firstName} ${member.lastName}`, activationToken, planName, formattedExpiry);
            } catch (err) {
                console.error("Failed to send activation email:", err.message);
            }
        }

        res.json({ member: updatedMember, payment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const purchaseClassSessionPackage = async (req, res) => {
    const memberId = Number(req.params.id);
    const {
        packageId,
        method = 'CASH',
        cashTendered,
        changeDue,
        gcashReference,
        gcashDate,
        gcashTime
    } = req.body;

    const { PAYMENT_METHODS } = require('../../config/businessConfig');
    const normalizedMethod = String(method).trim().toUpperCase();
    const validBaseMethods = (PAYMENT_METHODS || []).map(m => String(m.value).toUpperCase());
    const allowedMethods = [...new Set([...validBaseMethods, 'CARD', 'CASH', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER'])];

    if (!allowedMethods.includes(normalizedMethod)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const packageRecord = await prisma.classSessionPackage.findUnique({
            where: { id: Number(packageId) }
        });
        if (!packageRecord || !packageRecord.isActive) {
            return res.status(404).json({ error: "Class session package not found" });
        }

        const member = await prisma.member.findUnique({ where: { id: memberId } });
        if (!member) {
            return res.status(404).json({ error: "Member not found" });
        }

        const normalizedCashTendered = normalizedMethod === 'CASH'
            ? Number(cashTendered)
            : null;
        if (normalizedMethod === 'CASH' && (!Number.isFinite(normalizedCashTendered) || normalizedCashTendered < Number(packageRecord.price))) {
            return res.status(400).json({ error: "Cash tendered must cover package amount" });
        }
        const normalizedChangeDue = normalizedMethod === 'CASH'
            ? (changeDue !== undefined ? Number(changeDue) : (normalizedCashTendered - Number(packageRecord.price)))
            : null;
        if (normalizedMethod === 'CASH' && !Number.isFinite(normalizedChangeDue)) {
            return res.status(400).json({ error: "Invalid change due" });
        }
        if ((normalizedMethod === 'GCASH' || normalizedMethod === 'MAYA') && !gcashReference) {
            return res.status(400).json({ error: `${normalizedMethod} reference is required for e-wallet payments` });
        }

        const externalDate = (gcashDate && gcashTime) ? new Date(`${gcashDate}T${gcashTime}`) : null;
        const pointsAwarded = Math.floor(Number(packageRecord.price) / 100);

        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    amount: Number(packageRecord.price),
                    type: 'CLASS_SESSION_PACKAGE',
                    method: normalizedMethod,
                    status: 'COMPLETED',
                    memberId,
                    cashierId: req.user.id,
                    pointsAwarded,
                    cashTendered: normalizedMethod === 'CASH' ? normalizedCashTendered : null,
                    changeDue: normalizedMethod === 'CASH' ? normalizedChangeDue : null,
                    externalRef: (normalizedMethod === 'GCASH' || normalizedMethod === 'MAYA') ? (gcashReference || null) : null,
                    externalDate: (normalizedMethod === 'GCASH' || normalizedMethod === 'MAYA') ? externalDate : null
                }
            });

            await tx.paymentItem.create({
                data: {
                    paymentId: payment.id,
                    productId: null,
                    name: packageRecord.name,
                    type: 'CLASS_PACKAGE',
                    quantity: 1,
                    unitPrice: Number(packageRecord.price)
                }
            });

            const updatedMember = await tx.member.update({
                where: { id: memberId },
                data: {
                    classSessionsRemaining: { increment: Number(packageRecord.sessions) },
                    classSessionsPurchased: { increment: Number(packageRecord.sessions) },
                    ...(pointsAwarded > 0 ? { points: { increment: pointsAwarded } } : {})
                }
            });

            return { payment, member: updatedMember };
        });

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message || "Failed to purchase class session package" });
    }
};

const getMemberPayments = async (req, res) => {
    const { id } = req.params;
    try {
        const payments = await prisma.payment.findMany({
            where: { memberId: Number(id) },
            include: {
                items: true,
                cashier: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(payments);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch payment history" });
    }
};

const getMemberNotes = async (req, res) => {
    const { id } = req.params;
    try {
        const notes = await prisma.memberNote.findMany({
            where: { memberId: Number(id) },
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { id: true, name: true, email: true } } }
        });
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch notes" });
    }
};

const addMemberNote = async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || !String(content).trim()) {
        return res.status(400).json({ error: "Note content required" });
    }
    try {
        const note = await prisma.memberNote.create({
            data: {
                memberId: Number(id),
                content: String(content).trim(),
                createdBy: req.user.id
            },
            include: { author: { select: { id: true, name: true, email: true } } }
        });
        res.json(note);
    } catch (e) {
        res.status(500).json({ error: "Failed to create note" });
    }
};

const updateMemberStatus = async (req, res) => {
    const { id } = req.params;
    const { status, freezeStartDate, freezeEndDate } = req.body;
    try {
        const updateData = { status };

        if (status === 'FREEZED') {
            updateData.freezeStartDate = freezeStartDate ? new Date(freezeStartDate) : null;
            updateData.freezeEndDate = freezeEndDate ? new Date(freezeEndDate) : null;
        } else if (status === 'ACTIVE') {
            // Clear freeze dates when reactivating
            updateData.freezeStartDate = null;
            updateData.freezeEndDate = null;
        }

        const member = await prisma.member.update({
            where: { id: Number(id) },
            data: updateData
        });
        res.json(member);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updateMember = async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, phone, imageUrl, birthDate, sex, expiryDate, startDate } = req.body;
    try {
        if (req.user.role === 'MEMBER' && req.user.id !== Number(id)) {
            return res.sendStatus(403);
        }
        const member = await prisma.member.update({
            where: { id: Number(id) },
            data: {
                firstName,
                lastName,
                email,
                phone,
                imageUrl,
                birthDate: birthDate ? new Date(birthDate) : null,
                sex: sex || null,
                expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                startDate: startDate ? new Date(startDate) : undefined
            }
        });
        res.json(member);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const changePassword = async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    if (req.user.id !== Number(id)) return res.sendStatus(403);
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
    }
    try {
        const member = await prisma.member.findUnique({ where: { id: Number(id) } });
        if (!member || !member.password) {
            return res.status(400).json({ error: "Password is not set for this account" });
        }
        const ok = await bcrypt.compare(currentPassword, member.password);
        if (!ok) return res.status(400).json({ error: "Current password is incorrect" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.member.update({
            where: { id: Number(id) },
            data: { password: hashedPassword }
        });
        res.json({ message: "Password updated" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = {
    getMembers,
    getAvailableClasses,
    bookClass,
    cancelBooking,
    bookTraining,
    bookTrainingCash,
    getMemberProfile,
    getMyTrainingSessions,
    getMyClassBookings,
    rateTrainingSession,
    voidTrainingSessionRating,
    getPaymentMethods,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    createMember,
    renewMembership,
    purchaseClassSessionPackage,
    getMemberPayments,
    getMemberNotes,
    addMemberNote,
    updateMemberStatus,
    updateMember,
    changePassword,
    deleteMember
};
