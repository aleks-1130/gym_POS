const prisma = require('../../config/prisma');
const { isTimeAllowedForTrainer } = require('../../services/trainerAvailabilityService');
const { getPosConfig } = require('../../services/configService');
const bcrypt = require('bcryptjs');

const FINALIZED_SESSION_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'DECLINED'];
const CLASS_BOOKING_ID_PREFIX = 'CB-';
const CLASS_NO_SHOW_REFUND_REQUESTED_STATUS = 'NO_SHOW_REFUND_REQUESTED';
const CLASS_NO_SHOW_REFUND_APPROVED_STATUS = 'NO_SHOW_REFUND_APPROVED';
const CLASS_NO_SHOW_REFUND_REJECTED_STATUS = 'NO_SHOW_REFUND_REJECTED';
const CLASS_NO_SHOW_RESCHEDULE_REQUESTED_STATUS = 'NO_SHOW_RESCHEDULE_REQUESTED';
const CLASS_NO_SHOW_RESCHEDULE_APPROVED_STATUS = 'NO_SHOW_RESCHEDULE_APPROVED';
const CLASS_NO_SHOW_RESCHEDULE_REJECTED_STATUS = 'NO_SHOW_RESCHEDULE_REJECTED';
const CLASS_REFUND_REQUEST_STATUSES = [
    CLASS_NO_SHOW_REFUND_REQUESTED_STATUS,
    CLASS_NO_SHOW_REFUND_APPROVED_STATUS,
    CLASS_NO_SHOW_REFUND_REJECTED_STATUS
];
const CLASS_RESCHEDULE_REQUEST_STATUSES = [
    CLASS_NO_SHOW_RESCHEDULE_REQUESTED_STATUS,
    CLASS_NO_SHOW_RESCHEDULE_APPROVED_STATUS,
    CLASS_NO_SHOW_RESCHEDULE_REJECTED_STATUS
];

const toLocalIsoDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const parseRefundExceptionMeta = (notes) => {
    const lines = String(notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    let latestRequest = null;
    let latestResolution = null;

    for (const line of lines) {
        if (line.startsWith('REFUND_EXCEPTION_REQUESTED')) {
            const atMatch = line.match(/at ([^|]+)/);
            const reasonMatch = line.match(/reason=([^|]+)/);
            const detailsMatch = line.match(/details=(.+)$/);
            latestRequest = {
                raw: line,
                requestedAt: atMatch?.[1]?.trim() || null,
                reason: reasonMatch?.[1]?.trim() || 'OTHER',
                details: detailsMatch?.[1]?.trim() || null
            };
        }
        if (line.startsWith('REFUND_EXCEPTION_APPROVED') || line.startsWith('REFUND_EXCEPTION_REJECTED')) {
            const atMatch = line.match(/at ([^|]+)/);
            const byMatch = line.match(/by ([^|]+)/);
            const noteMatch = line.match(/note=(.+)$/);
            latestResolution = {
                raw: line,
                status: line.startsWith('REFUND_EXCEPTION_APPROVED') ? 'APPROVED' : 'REJECTED',
                resolvedAt: atMatch?.[1]?.trim() || null,
                resolvedBy: byMatch?.[1]?.trim() || null,
                note: noteMatch?.[1]?.trim() || null
            };
        }
    }

    const hasRequest = Boolean(latestRequest);
    const isResolved = Boolean(latestResolution);
    return {
        hasRequest,
        isResolved,
        request: latestRequest,
        resolution: latestResolution
    };
};

const parseTrainerChangeRequestMeta = (notes) => {
    const lines = String(notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    let latestRequest = null;
    let latestResolution = null;

    for (const line of lines) {
        if (line.startsWith('TRAINER_CHANGE_REQUESTED')) {
            const atMatch = line.match(/at ([^|]+)/);
            const reasonMatch = line.match(/reason=([^|]+)/);
            const preferredMatch = line.match(/preferred=([^|]+)/);
            latestRequest = {
                raw: line,
                requestedAt: atMatch?.[1]?.trim() || null,
                reason: reasonMatch?.[1]?.trim() || null,
                preferred: preferredMatch?.[1]?.trim() || null
            };
        }
        if (line.startsWith('TRAINER_CHANGE_RESOLVED')) {
            const byMatch = line.match(/by ([^|]+)/);
            const atMatch = line.match(/at ([^|]+)/);
            const actionMatch = line.match(/action=([^|]+)/);
            const noteMatch = line.match(/note=(.+)$/);
            latestResolution = {
                raw: line,
                resolvedBy: byMatch?.[1]?.trim() || null,
                resolvedAt: atMatch?.[1]?.trim() || null,
                action: actionMatch?.[1]?.trim() || null,
                note: noteMatch?.[1]?.trim() || null
            };
        }
    }

    return {
        hasRequest: Boolean(latestRequest),
        isResolved: Boolean(latestResolution),
        request: latestRequest,
        resolution: latestResolution
    };
};

const appendNote = (currentNotes, line) => {
    return [String(currentNotes || '').trim(), line].filter(Boolean).join('\n');
};

const validateStaffVoidPin = async (req) => {
    const role = String(req.user?.role || '').toUpperCase();
    if (role !== 'STAFF') {
        return { ok: true };
    }

    const pin = String(req.body?.pin || '').trim();
    if (!pin) {
        return {
            ok: false,
            status: 400,
            error: 'Admin void PIN is required for staff refund decisions.'
        };
    }

    const config = await getPosConfig(req.user.gymId, req.user.tenantId);
    if (!config?.voidPinHash) {
        return {
            ok: false,
            status: 400,
            error: 'Void PIN is not configured.'
        };
    }

    const pinValid = await bcrypt.compare(pin, config.voidPinHash);
    if (!pinValid) {
        return {
            ok: false,
            status: 403,
            error: 'Invalid admin void PIN.'
        };
    }

    return { ok: true };
};

const parseRequestTarget = (rawId) => {
    const raw = String(rawId || '').trim();
    const classMatch = raw.match(/^CB-(\d+)$/i);
    if (classMatch) {
        const id = Number(classMatch[1]);
        if (Number.isInteger(id) && id > 0) {
            return { entity: 'CLASS_BOOKING', id };
        }
    }

    const numericId = Number(raw);
    if (Number.isInteger(numericId) && numericId > 0) {
        return { entity: 'TRAINING_SESSION', id: numericId };
    }
    return null;
};

const toClassBookingRequestId = (bookingId) => `${CLASS_BOOKING_ID_PREFIX}${Number(bookingId)}`;

const restoreMemberClassSessionCredit = async (tx, memberId) => {
    const normalizedMemberId = Number(memberId);
    if (!Number.isInteger(normalizedMemberId) || normalizedMemberId <= 0) return;

    const member = await tx.member.findUnique({
        where: { id: normalizedMemberId },
        select: {
            classSessionsRemaining: true,
            classSessionsUsed: true
        }
    });
    if (!member) return;

    const usedCount = Math.max(0, Number(member.classSessionsUsed || 0));
    await tx.member.update({
        where: { id: normalizedMemberId },
        data: {
            classSessionsRemaining: { increment: 1 },
            ...(usedCount > 0 ? { classSessionsUsed: { decrement: 1 } } : {})
        }
    });
};

const toMoney = (value) => Number(Number(value || 0).toFixed(2));

const paymentRefundableBalance = (payment) => {
    const amount = toMoney(payment?.amount);
    const refunded = toMoney(payment?.refundedAmount);
    return Math.max(0, toMoney(amount - refunded));
};

const sortPaymentsByTargetDate = (payments, targetDateInput) => {
    const targetDate = new Date(targetDateInput || new Date());
    const targetTs = Number.isNaN(targetDate.getTime()) ? Date.now() : targetDate.getTime();

    return [...payments].sort((a, b) => {
        const aTs = new Date(a?.date || 0).getTime();
        const bTs = new Date(b?.date || 0).getTime();
        const aDistance = Math.abs(aTs - targetTs);
        const bDistance = Math.abs(bTs - targetTs);
        if (aDistance !== bDistance) return aDistance - bDistance;
        return bTs - aTs;
    });
};

const applyTrainingPaymentRefund = async (tx, { memberId, amount, targetDate }) => {
    let remaining = toMoney(amount);
    if (remaining <= 0) return [];

    const payments = await tx.payment.findMany({
        where: {
            memberId: Number(memberId),
            type: 'TRAINING',
            status: { in: ['COMPLETED', 'RETURNED'] }
        },
        select: {
            id: true,
            amount: true,
            refundedAmount: true,
            status: true,
            date: true
        },
        orderBy: { date: 'desc' }
    });

    const sorted = sortPaymentsByTargetDate(payments, targetDate);
    const allocations = [];

    for (const payment of sorted) {
        const refundable = paymentRefundableBalance(payment);
        if (refundable <= 0) continue;

        const refundableNow = Math.min(refundable, remaining);
        if (refundableNow <= 0) continue;

        const nextRefundedAmount = toMoney(toMoney(payment.refundedAmount) + refundableNow);
        const updated = await tx.payment.update({
            where: { id: payment.id },
            data: {
                refundedAmount: nextRefundedAmount,
                status: nextRefundedAmount > 0 ? 'RETURNED' : payment.status
            },
            select: {
                id: true,
                amount: true,
                refundedAmount: true,
                status: true
            }
        });

        allocations.push({
            paymentId: updated.id,
            refunded: refundableNow,
            refundedAmount: updated.refundedAmount,
            status: updated.status
        });

        remaining = toMoney(remaining - refundableNow);
        if (remaining <= 0) break;
    }

    if (remaining > 0) {
        const err = new Error("No matching paid training transaction found to reverse this refund amount.");
        err.status = 409;
        throw err;
    }

    return allocations;
};

const checkBookingConflict = async (trainerId, startDateTime, durationMinutes, excludeSessionId = null) => {
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    const startOfDay = new Date(startDateTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const sessions = await prisma.trainingSession.findMany({
        where: {
            trainerId: Number(trainerId),
            date: {
                gte: startOfDay,
                lt: endOfDay
            },
            status: { not: 'CANCELLED' },
            ...(excludeSessionId ? { id: { not: Number(excludeSessionId) } } : {})
        }
    });

    return sessions.some((session) => {
        const sessionStart = new Date(session.date);
        const sessionEnd = new Date(sessionStart.getTime() + (Number(session.duration) || 0) * 60000);
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

const createPaymentCompat = async (tx, data) => {
    const paymentData = { ...data };
    const removableOptionalFields = new Set(['discount', 'cashTendered', 'changeDue', 'externalRef', 'externalDate']);
    const originalMemberId = paymentData.memberId;
    const originalCashierId = paymentData.cashierId;

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

// Staff/Admin book a trainer session for a member
const bookTraining = async (req, res) => {
    const { memberId, trainerId, date, time, duration, notes, method, externalRef, externalDate } = req.body;
    if (!memberId || !trainerId || !date || !time || !duration || !method) {
        return res.status(400).json({ error: "Missing required booking details" });
    }
    const allowedMethods = ['CASH', 'CARD', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        const startDateTime = new Date(`${date}T${time}`);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date or time" });
        }
        const allowClosedBookingToday = await shouldTemporarilyOpenTrainerForDate({ trainerId: Number(trainerId), date });
        if (!(await isTimeAllowedForTrainer({
            trainerId: Number(trainerId),
            date,
            time,
            duration: Number(duration),
            enforceBookingStatus: !allowClosedBookingToday
        }))) {
            return res.status(400).json({ error: "Selected schedule is outside trainer availability" });
        }

        const totalAmount = ((trainer.sessionPrice || 0) / 60) * Number(duration);

        await prisma.$transaction(async (tx) => {
            await tx.trainingSession.create({
                data: {
                    memberId: Number(memberId),
                    trainerId: Number(trainerId),
                    date: startDateTime,
                    duration: Number(duration),
                    price: totalAmount,
                    status: 'SCHEDULED',
                    paymentStatus: 'PAID',
                    paymentMethod: method,
                    paidAt: new Date(),
                    notes: notes || null,
                    gymId: Number(req.user.gymId),
                    tenantId: Number(req.user.tenantId)
                }
            });

            await createPaymentCompat(tx, {
                amount: totalAmount,
                type: 'TRAINING',
                method,
                status: 'COMPLETED',
                memberId: Number(memberId),
                cashierId: req.user.id,
                gymId: Number(req.user.gymId),
                tenantId: Number(req.user.tenantId),
                externalRef: ['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) ? (externalRef || null) : null,
                externalDate: (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) && externalDate) ? new Date(externalDate) : null
            });

        });

        res.json({ message: "Training session booked and paid" });
    } catch (e) {
        res.status(500).json({ error: "Failed to book training session", detail: e?.message });
    }
};

// Staff view trainer bookings (e.g., unpaid)
const getTrainingSessions = async (req, res) => {
    const { status } = req.query; // paymentStatus filter: UNPAID/PAID
    try {
        const getGymId = () => Number(req.gymId || req.user?.gymId);
        const tenantId = Number(req.user.tenantId);
        const currentGymId = Number(req.user.gymId);
        
        const where = {
            ...(status ? { paymentStatus: String(status).toUpperCase() } : {}),
            status: { not: 'CANCELLED' },
            gymId: currentGymId,
            tenantId
        };
        const sessions = await prisma.trainingSession.findMany({
            where,
            include: { member: true, trainer: true },
            orderBy: { date: 'asc' }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Staff collect payment for an unpaid trainer booking
const collectSessionPayment = async (req, res) => {
    const sessionId = Number(req.params.id);
    const { method = 'CASH', cashTendered, externalRef, externalDate } = req.body;
    const allowedMethods = ['CASH', 'CARD', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId },
            include: { member: true }
        });
        if (!session) return res.status(404).json({ error: "Training session not found" });
        if (session.paymentStatus === 'PAID') return res.status(400).json({ error: "Session already paid" });

        const amount = session.price;
        const tendered = method === 'CASH' && cashTendered !== undefined ? Number(cashTendered) : null;
        const changeDue = method === 'CASH' && tendered !== null ? Math.max(0, tendered - amount) : null;

        const payment = await prisma.$transaction(async (tx) => {
            const updated = await tx.trainingSession.update({
                where: { id: sessionId },
                data: {
                    paymentStatus: 'PAID',
                    paymentMethod: method,
                    paidAt: new Date()
                }
            });

            const payment = await createPaymentCompat(tx, {
                amount,
                type: 'TRAINING',
                method,
                status: 'COMPLETED',
                memberId: session.memberId,
                cashierId: req.user.id,
                cashTendered: method === 'CASH' ? tendered : null,
                changeDue: method === 'CASH' ? changeDue : null,
                externalRef: ['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) ? (externalRef || null) : null,
                externalDate: (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) && externalDate) ? new Date(externalDate) : null
            });

            return { updated, payment };
        });

        res.json(payment);
    } catch (e) {
        res.status(500).json({ error: "Failed to collect payment", detail: e?.message });
    }
};

// Staff collect payment for multiple unpaid trainer bookings at once
const collectSessionBatchPayment = async (req, res) => {
    const sessionIdsRaw = Array.isArray(req.body?.sessionIds) ? req.body.sessionIds : [];
    const { method = 'CASH', cashTendered, externalRef, externalDate } = req.body || {};
    const allowedMethods = ['CASH', 'CARD', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    const sessionIds = [...new Set(
        sessionIdsRaw
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];
    if (sessionIds.length === 0) {
        return res.status(400).json({ error: "At least one valid session ID is required" });
    }

    try {
        const sessions = await prisma.trainingSession.findMany({
            where: { id: { in: sessionIds } },
            include: { member: true }
        });
        if (sessions.length !== sessionIds.length) {
            return res.status(404).json({ error: "One or more training sessions were not found" });
        }
        if (sessions.some((session) => session.paymentStatus === 'PAID')) {
            return res.status(400).json({ error: "One or more sessions are already paid" });
        }
        if (sessions.some((session) => String(session.status || '').toUpperCase() === 'CANCELLED')) {
            return res.status(400).json({ error: "Cannot collect payment for cancelled sessions" });
        }

        const memberIds = [...new Set(sessions.map((session) => Number(session.memberId)))];
        if (memberIds.length !== 1) {
            return res.status(400).json({ error: "Batch collection requires sessions from the same member" });
        }

        const amount = sessions.reduce((sum, session) => sum + Number(session.price || 0), 0);
        const tendered = method === 'CASH' && cashTendered !== undefined ? Number(cashTendered) : null;
        if (method === 'CASH' && (!Number.isFinite(tendered) || tendered < amount)) {
            return res.status(400).json({ error: "Cash tendered is invalid or less than amount" });
        }
        const changeDue = method === 'CASH' ? Math.max(0, Number(tendered || 0) - amount) : null;
        const paidAt = new Date();

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.trainingSession.updateMany({
                where: {
                    id: { in: sessionIds },
                    paymentStatus: 'UNPAID'
                },
                data: {
                    paymentStatus: 'PAID',
                    paymentMethod: method,
                    paidAt
                }
            });
            if (updated.count !== sessionIds.length) {
                throw new Error("Some sessions were modified before collection. Please refresh and try again.");
            }

            const payment = await createPaymentCompat(tx, {
                amount,
                type: 'TRAINING',
                method,
                status: 'COMPLETED',
                memberId: memberIds[0],
                cashierId: req.user.id,
                cashTendered: method === 'CASH' ? tendered : null,
                changeDue: method === 'CASH' ? changeDue : null,
                externalRef: ['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) ? (externalRef || null) : null,
                externalDate: (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) && externalDate) ? new Date(externalDate) : null
            });

            return { updatedCount: updated.count, payment };
        });

        res.json({
            message: "Collected payment for training booking batch",
            ...result,
            sessionIds
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to collect batch payment", detail: e?.message });
    }
};

// Staff decline/cancel an unpaid trainer booking
const declineSessionBooking = async (req, res) => {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: "Invalid session ID" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) return res.status(404).json({ error: "Training session not found" });
        if (session.paymentStatus === 'PAID') {
            return res.status(400).json({ error: "Cannot decline a paid booking" });
        }
        if (session.status === 'CANCELLED') {
            return res.json({ ...session, message: "Booking already cancelled" });
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                status: 'CANCELLED',
                paymentStatus: 'UNPAID',
                notes: [session.notes, `Declined by staff ${req.user.id} on ${new Date().toISOString()}`]
                    .filter(Boolean)
                    .join('\n')
            }
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to decline booking", detail: e?.message });
    }
};

const getRefundExceptionRequests = async (req, res) => {
    const statusFilter = String(req.query.status || 'PENDING').toUpperCase();
    if (!['PENDING', 'RESOLVED', 'ALL'].includes(statusFilter)) {
        return res.status(400).json({ error: "status must be PENDING, RESOLVED, or ALL" });
    }

    try {
        const [sessions, classBookings] = await Promise.all([
            prisma.trainingSession.findMany({
                where: {
                    notes: { contains: 'REFUND_EXCEPTION_REQUESTED' }
                },
                include: { member: true, trainer: true },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.booking.findMany({
                where: {
                    status: { in: CLASS_REFUND_REQUEST_STATUSES }
                },
                include: {
                    member: true,
                    class: {
                        include: {
                            trainer: true
                        }
                    }
                },
                orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }]
            })
        ]);

        const normalizedSessions = sessions.map((session) => {
            const meta = parseRefundExceptionMeta(session.notes);
            return {
                ...session,
                requestEntity: 'TRAINING_SESSION',
                refundException: {
                    status: !meta.hasRequest ? 'NONE' : (meta.isResolved ? meta.resolution.status : 'PENDING'),
                    request: meta.request,
                    resolution: meta.resolution
                }
            };
        });

        const normalizedClassBookings = classBookings.map((booking) => {
            const rawStatus = String(booking.status || '').toUpperCase();
            const refundStatus = rawStatus === CLASS_NO_SHOW_REFUND_REQUESTED_STATUS
                ? 'PENDING'
                : rawStatus === CLASS_NO_SHOW_REFUND_APPROVED_STATUS
                    ? 'APPROVED'
                    : 'REJECTED';
            return {
                ...booking,
                id: toClassBookingRequestId(booking.id),
                date: booking.sessionDate,
                trainer: booking.class?.trainer || null,
                requestEntity: 'CLASS_BOOKING',
                refundException: {
                    status: refundStatus,
                    request: {
                        requestedAt: booking.createdAt || null,
                        reason: 'CLASS_NO_SHOW',
                        details: booking.class?.name ? `Class: ${booking.class.name}` : null
                    },
                    resolution: refundStatus === 'PENDING'
                        ? null
                        : {
                            status: refundStatus,
                            resolvedAt: null,
                            resolvedBy: null,
                            note: null
                        }
                }
            };
        });

        const normalized = [...normalizedSessions, ...normalizedClassBookings]
            .filter((entry) => {
                if (statusFilter === 'ALL') return true;
                if (statusFilter === 'PENDING') return entry.refundException.status === 'PENDING';
                return entry.refundException.status !== 'PENDING';
            })
            .sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.date || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.date || b.createdAt || 0).getTime();
                return dateB - dateA;
            });

        res.json(normalized);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch refund exception requests", detail: e?.message });
    }
};

const resolveRefundException = async (req, res) => {
    const target = parseRequestTarget(req.params.id);
    const decision = String(req.body?.decision || '').toUpperCase();
    const resolutionNote = String(req.body?.note || '').trim();

    if (!['APPROVE', 'REJECT'].includes(decision)) {
        return res.status(400).json({ error: "decision must be APPROVE or REJECT" });
    }
    if (!target) {
        return res.status(400).json({ error: "Invalid request id" });
    }

    try {
        const pinCheck = await validateStaffVoidPin(req);
        if (!pinCheck.ok) {
            return res.status(pinCheck.status).json({ error: pinCheck.error });
        }

        if (target.entity === 'CLASS_BOOKING') {
            const booking = await prisma.booking.findUnique({
                where: { id: target.id }
            });
            if (!booking) {
                return res.status(404).json({ error: "Class booking request not found" });
            }
            const currentStatus = String(booking.status || '').toUpperCase();
            if (currentStatus !== CLASS_NO_SHOW_REFUND_REQUESTED_STATUS) {
                if (currentStatus === CLASS_NO_SHOW_REFUND_APPROVED_STATUS || currentStatus === CLASS_NO_SHOW_REFUND_REJECTED_STATUS) {
                    return res.status(400).json({ error: "Refund exception request is already resolved" });
                }
                return res.status(400).json({ error: "No refund exception request found for this class booking" });
            }

            const nextStatus = decision === 'APPROVE'
                ? CLASS_NO_SHOW_REFUND_APPROVED_STATUS
                : CLASS_NO_SHOW_REFUND_REJECTED_STATUS;

            const updated = await prisma.$transaction(async (tx) => {
                const saved = await tx.booking.update({
                    where: { id: target.id },
                    data: { status: nextStatus }
                });
                if (decision === 'APPROVE') {
                    await restoreMemberClassSessionCredit(tx, saved.memberId);
                }
                return saved;
            });

            return res.json({
                message: `Class refund request ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
                session: updated
            });
        }

        const session = await prisma.trainingSession.findUnique({
            where: { id: target.id },
            include: {
                trainer: {
                    select: {
                        id: true,
                        name: true,
                        commissionRate: true
                    }
                }
            }
        });
        if (!session) return res.status(404).json({ error: "Training session not found" });

        const meta = parseRefundExceptionMeta(session.notes);
        if (!meta.hasRequest) {
            return res.status(400).json({ error: "No refund exception request found for this session" });
        }
        if (meta.isResolved) {
            return res.status(400).json({ error: "Refund exception request is already resolved" });
        }

        const resolutionTag = decision === 'APPROVE' ? 'REFUND_EXCEPTION_APPROVED' : 'REFUND_EXCEPTION_REJECTED';
        const resolutionLine = `${resolutionTag} by ${req.user.role}#${req.user.id} at ${new Date().toISOString()}${resolutionNote ? ` | note=${resolutionNote}` : ''}`;

        if (decision === 'APPROVE') {
            const updateData = {
                notes: appendNote(session.notes, resolutionLine),
                ...(String(session.status || '').toUpperCase() !== 'CANCELLED' ? { status: 'CANCELLED' } : {})
            };

            const result = await prisma.$transaction(async (tx) => {
                const shouldReversePayment = String(session.paymentStatus || '').toUpperCase() === 'PAID' && Number(session.price || 0) > 0;
                const refundAllocations = shouldReversePayment
                    ? await applyTrainingPaymentRefund(tx, {
                        memberId: session.memberId,
                        amount: Number(session.price || 0),
                        targetDate: session.paidAt || session.date || session.updatedAt || new Date()
                    })
                    : [];

                if (
                    String(session.status || '').toUpperCase() === 'COMPLETED'
                    && Boolean(session.commissionPaid)
                    && Number(session.trainerId) > 0
                ) {
                    const commissionAmount = toMoney(Number(session.price || 0) * Number(session.trainer?.commissionRate || 0));
                    if (commissionAmount > 0) {
                        await tx.expense.create({
                            data: {
                                title: `Commission Reversal: ${session.trainer?.name || `Trainer #${session.trainerId}`}`,
                                amount: -commissionAmount,
                                category: 'SALARY',
                                date: new Date(),
                                notes: `Auto reversal for refunded training session #${session.id}`,
                                recordedBy: `${req.user.role}#${req.user.id}`,
                                trainerId: Number(session.trainerId),
                                gymId: session.gymId || req.user.gymId,
                                tenantId: session.tenantId || req.user.tenantId
                            }
                        });
                    }
                }

                const savedSession = await tx.trainingSession.update({
                    where: { id: target.id },
                    data: updateData
                });

                return {
                    session: savedSession,
                    refundAllocations
                };
            });

            return res.json({
                message: "Refund exception approved. Payment reversed and session cancelled successfully.",
                session: result.session,
                refundAllocations: result.refundAllocations
            });
        }

        const updated = await prisma.trainingSession.update({
            where: { id: target.id },
            data: {
                notes: appendNote(session.notes, resolutionLine)
            }
        });

        return res.json({
            message: "Refund exception rejected successfully.",
            session: updated
        });
    } catch (e) {
        res.status(e?.status || 500).json({ error: "Failed to resolve refund exception", detail: e?.message });
    }
};

const getTrainerChangeRequests = async (req, res) => {
    const statusFilter = String(req.query.status || 'PENDING').toUpperCase();
    if (!['PENDING', 'RESOLVED', 'ALL'].includes(statusFilter)) {
        return res.status(400).json({ error: "status must be PENDING, RESOLVED, or ALL" });
    }

    try {
        const [sessions, classBookings] = await Promise.all([
            prisma.trainingSession.findMany({
                where: { notes: { contains: 'TRAINER_CHANGE_REQUESTED' } },
                include: { member: true, trainer: true },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.booking.findMany({
                where: {
                    status: { in: CLASS_RESCHEDULE_REQUEST_STATUSES }
                },
                include: {
                    member: true,
                    class: {
                        include: {
                            trainer: true
                        }
                    }
                },
                orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }]
            })
        ]);

        const normalizedSessions = sessions.map((session) => {
            const meta = parseTrainerChangeRequestMeta(session.notes);
            return {
                ...session,
                requestEntity: 'TRAINING_SESSION',
                trainerChangeRequest: {
                    status: !meta.hasRequest ? 'NONE' : (meta.isResolved ? 'RESOLVED' : 'PENDING'),
                    request: meta.request,
                    resolution: meta.resolution
                }
            };
        });

        const normalizedClassBookings = classBookings.map((booking) => {
            const rawStatus = String(booking.status || '').toUpperCase();
            const requestStatus = rawStatus === CLASS_NO_SHOW_RESCHEDULE_REQUESTED_STATUS ? 'PENDING' : 'RESOLVED';
            const resolutionAction = rawStatus === CLASS_NO_SHOW_RESCHEDULE_APPROVED_STATUS ? 'CANCEL_CREDIT' : 'DENY';

            return {
                ...booking,
                id: toClassBookingRequestId(booking.id),
                date: booking.sessionDate,
                trainer: booking.class?.trainer || null,
                requestEntity: 'CLASS_BOOKING',
                trainerChangeRequest: {
                    status: requestStatus,
                    request: {
                        requestedAt: booking.createdAt || null,
                        reason: 'CLASS_NO_SHOW_RESCHEDULE',
                        preferred: null
                    },
                    resolution: requestStatus === 'PENDING'
                        ? null
                        : {
                            resolvedBy: null,
                            resolvedAt: null,
                            action: resolutionAction,
                            note: null
                        }
                }
            };
        });

        const normalized = [...normalizedSessions, ...normalizedClassBookings]
            .filter((entry) => {
                if (statusFilter === 'ALL') return true;
                if (statusFilter === 'PENDING') return entry.trainerChangeRequest.status === 'PENDING';
                return entry.trainerChangeRequest.status === 'RESOLVED';
            })
            .sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.date || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.date || b.createdAt || 0).getTime();
                return dateB - dateA;
            });

        res.json(normalized);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer change requests", detail: e?.message });
    }
};

const resolveTrainerChangeRequest = async (req, res) => {
    const target = parseRequestTarget(req.params.id);
    const action = String(req.body?.action || '').toUpperCase();
    const note = String(req.body?.note || '').trim();
    const date = String(req.body?.date || '').trim();
    const time = String(req.body?.time || '').trim();
    const allowedActions = ['MOVE', 'CANCEL_CREDIT', 'CANCEL_REFUND', 'DENY'];

    if (!allowedActions.includes(action)) {
        return res.status(400).json({ error: `action must be one of: ${allowedActions.join(', ')}` });
    }
    if (!target) {
        return res.status(400).json({ error: "Invalid request id" });
    }

    try {
        if (target.entity === 'CLASS_BOOKING') {
            const booking = await prisma.booking.findUnique({
                where: { id: target.id }
            });
            if (!booking) {
                return res.status(404).json({ error: "Class booking request not found" });
            }

            const status = String(booking.status || '').toUpperCase();
            if (status !== CLASS_NO_SHOW_RESCHEDULE_REQUESTED_STATUS) {
                if (status === CLASS_NO_SHOW_RESCHEDULE_APPROVED_STATUS || status === CLASS_NO_SHOW_RESCHEDULE_REJECTED_STATUS) {
                    return res.status(400).json({ error: "Session change request is already resolved" });
                }
                return res.status(400).json({ error: "No session change request found for this class booking" });
            }

            if (action === 'MOVE') {
                return res.status(400).json({ error: "MOVE action is not supported for class no-show requests. Use Cancel & Credit, Cancel & Refund, or Deny." });
            }

            const shouldApprove = action === 'CANCEL_CREDIT' || action === 'CANCEL_REFUND';
            const nextStatus = shouldApprove
                ? CLASS_NO_SHOW_RESCHEDULE_APPROVED_STATUS
                : CLASS_NO_SHOW_RESCHEDULE_REJECTED_STATUS;

            const updated = await prisma.$transaction(async (tx) => {
                const saved = await tx.booking.update({
                    where: { id: target.id },
                    data: { status: nextStatus }
                });
                if (shouldApprove) {
                    await restoreMemberClassSessionCredit(tx, saved.memberId);
                }
                return saved;
            });

            return res.json({
                message: "Session change request resolved successfully.",
                session: updated
            });
        }

        const session = await prisma.trainingSession.findUnique({
            where: { id: target.id }
        });
        if (!session) return res.status(404).json({ error: "Training session not found" });

        const meta = parseTrainerChangeRequestMeta(session.notes);
        if (!meta.hasRequest) {
            return res.status(400).json({ error: "No trainer change request found for this session" });
        }
        if (meta.isResolved) {
            return res.status(400).json({ error: "Trainer change request is already resolved" });
        }

        const updateData = {};
        let actionDetail = action;

        if (action === 'MOVE') {
            if (!date || !time) {
                return res.status(400).json({ error: "date and time are required for MOVE action" });
            }
            const nextDateTime = new Date(`${date}T${time}`);
            if (Number.isNaN(nextDateTime.getTime())) {
                return res.status(400).json({ error: "Invalid move date/time" });
            }
            const allowClosedBookingToday = await shouldTemporarilyOpenTrainerForDate({
                trainerId: Number(session.trainerId),
                date
            });
            if (!(await isTimeAllowedForTrainer({
                trainerId: Number(session.trainerId),
                date,
                time,
                duration: Number(session.duration),
                enforceBookingStatus: !allowClosedBookingToday
            }))) {
                return res.status(400).json({ error: "Selected schedule is outside trainer availability" });
            }
            if (await checkBookingConflict(Number(session.trainerId), nextDateTime, Number(session.duration), session.id)) {
                return res.status(409).json({ error: "Selected schedule overlaps another session" });
            }
            updateData.date = nextDateTime;
            updateData.status = 'RESCHEDULED';
            actionDetail = `MOVE(${date} ${time})`;
        } else if (action === 'CANCEL_CREDIT' || action === 'CANCEL_REFUND') {
            updateData.status = 'CANCELLED';
            actionDetail = action;
        } else if (action === 'DENY') {
            const currentStatus = String(session.status || '').toUpperCase();
            updateData.status = currentStatus === 'NO_SHOW' ? 'NO_SHOW' : 'SCHEDULED';
            actionDetail = 'DENY';
        }

        const resolutionLine = `TRAINER_CHANGE_RESOLVED by ${req.user.role}#${req.user.id} at ${new Date().toISOString()} | action=${actionDetail}${note ? ` | note=${note}` : ''}`;
        updateData.notes = appendNote(session.notes, resolutionLine);

        const updated = await prisma.trainingSession.update({
            where: { id: target.id },
            data: updateData
        });

        res.json({
            message: "Trainer change request resolved successfully.",
            session: updated
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to resolve trainer change request", detail: e?.message });
    }
};

module.exports = {
    bookTraining,
    getTrainingSessions,
    collectSessionPayment,
    collectSessionBatchPayment,
    declineSessionBooking,
    getRefundExceptionRequests,
    resolveRefundException,
    getTrainerChangeRequests,
    resolveTrainerChangeRequest
};
