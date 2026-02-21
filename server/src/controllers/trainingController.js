const prisma = require('../config/prisma');
const { isTimeAllowedForTrainer } = require('../services/trainerAvailabilityService');

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
    const { memberId, trainerId, date, time, duration, notes, method } = req.body;
    if (!memberId || !trainerId || !date || !time || !duration || !method) {
        return res.status(400).json({ error: "Missing required booking details" });
    }
    const allowedMethods = ['CASH', 'CARD', 'GCASH', 'MAYA'];
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
        if (!isTimeAllowedForTrainer({ trainerId: Number(trainerId), date, time, duration: Number(duration) })) {
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
                    notes: notes || null
                }
            });

            await createPaymentCompat(tx, {
                amount: totalAmount,
                type: 'TRAINING',
                method,
                status: 'COMPLETED',
                memberId: Number(memberId),
                cashierId: req.user.id
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
        const where = {
            ...(status ? { paymentStatus: String(status).toUpperCase() } : {}),
            status: { not: 'CANCELLED' }
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
    const { method = 'CASH', cashTendered } = req.body;
    const allowedMethods = ['CASH', 'CARD', 'GCASH', 'MAYA'];
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
                changeDue: method === 'CASH' ? changeDue : null
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
    const { method = 'CASH', cashTendered } = req.body || {};
    const allowedMethods = ['CASH', 'CARD', 'GCASH', 'MAYA'];
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
                changeDue: method === 'CASH' ? changeDue : null
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
        const sessions = await prisma.trainingSession.findMany({
            where: {
                notes: { contains: 'REFUND_EXCEPTION_REQUESTED' }
            },
            include: { member: true, trainer: true },
            orderBy: { updatedAt: 'desc' }
        });

        const normalized = sessions
            .map((session) => {
                const meta = parseRefundExceptionMeta(session.notes);
                return {
                    ...session,
                    refundException: {
                        status: !meta.hasRequest ? 'NONE' : (meta.isResolved ? meta.resolution.status : 'PENDING'),
                        request: meta.request,
                        resolution: meta.resolution
                    }
                };
            })
            .filter((session) => {
                if (statusFilter === 'ALL') return true;
                if (statusFilter === 'PENDING') return session.refundException.status === 'PENDING';
                return session.refundException.status !== 'PENDING';
            });

        res.json(normalized);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch refund exception requests", detail: e?.message });
    }
};

const resolveRefundException = async (req, res) => {
    const sessionId = Number(req.params.id);
    const decision = String(req.body?.decision || '').toUpperCase();
    const resolutionNote = String(req.body?.note || '').trim();

    if (!['APPROVE', 'REJECT'].includes(decision)) {
        return res.status(400).json({ error: "decision must be APPROVE or REJECT" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
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

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                notes: appendNote(session.notes, resolutionLine)
            }
        });

        res.json({
            message: `Refund exception ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
            session: updated
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to resolve refund exception", detail: e?.message });
    }
};

const getTrainerChangeRequests = async (req, res) => {
    const statusFilter = String(req.query.status || 'PENDING').toUpperCase();
    if (!['PENDING', 'RESOLVED', 'ALL'].includes(statusFilter)) {
        return res.status(400).json({ error: "status must be PENDING, RESOLVED, or ALL" });
    }

    try {
        const sessions = await prisma.trainingSession.findMany({
            where: { notes: { contains: 'TRAINER_CHANGE_REQUESTED' } },
            include: { member: true, trainer: true },
            orderBy: { updatedAt: 'desc' }
        });

        const normalized = sessions
            .map((session) => {
                const meta = parseTrainerChangeRequestMeta(session.notes);
                return {
                    ...session,
                    trainerChangeRequest: {
                        status: !meta.hasRequest ? 'NONE' : (meta.isResolved ? 'RESOLVED' : 'PENDING'),
                        request: meta.request,
                        resolution: meta.resolution
                    }
                };
            })
            .filter((session) => {
                if (statusFilter === 'ALL') return true;
                if (statusFilter === 'PENDING') return session.trainerChangeRequest.status === 'PENDING';
                return session.trainerChangeRequest.status === 'RESOLVED';
            });

        res.json(normalized);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer change requests", detail: e?.message });
    }
};

const resolveTrainerChangeRequest = async (req, res) => {
    const sessionId = Number(req.params.id);
    const action = String(req.body?.action || '').toUpperCase();
    const note = String(req.body?.note || '').trim();
    const date = String(req.body?.date || '').trim();
    const time = String(req.body?.time || '').trim();
    const allowedActions = ['MOVE', 'CANCEL_CREDIT', 'CANCEL_REFUND', 'DENY'];

    if (!allowedActions.includes(action)) {
        return res.status(400).json({ error: `action must be one of: ${allowedActions.join(', ')}` });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
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
            if (!isTimeAllowedForTrainer({
                trainerId: Number(session.trainerId),
                date,
                time,
                duration: Number(session.duration)
            })) {
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
            updateData.status = 'SCHEDULED';
            actionDetail = 'DENY';
        }

        const resolutionLine = `TRAINER_CHANGE_RESOLVED by ${req.user.role}#${req.user.id} at ${new Date().toISOString()} | action=${actionDetail}${note ? ` | note=${note}` : ''}`;
        updateData.notes = appendNote(session.notes, resolutionLine);

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
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
