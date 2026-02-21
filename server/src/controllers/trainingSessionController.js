const prisma = require('../config/prisma');
const { isTimeAllowedForTrainer } = require('../services/trainerAvailabilityService');

const MEMBER_RESCHEDULE_NOTICE_HOURS = 24;
const MEMBER_RESCHEDULE_WINDOW_DAYS = 7;
const COMPLETE_GRACE_MINUTES = 5;
const NO_SHOW_GRACE_MINUTES = 10;

const appendPolicyNote = (existingNotes, extraLine) => {
    const base = (existingNotes || '').trim();
    return [base, extraLine].filter(Boolean).join('\n');
};

const isSessionTerminal = (status) => {
    return ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(String(status || '').toUpperCase());
};

const canFinalizeAttendanceStatus = (status) => {
    return ['SCHEDULED', 'RESCHEDULED'].includes(String(status || '').toUpperCase());
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

const getAllSessions = async (req, res) => {
    try {
        const sessions = await prisma.trainingSession.findMany({
            orderBy: { date: 'desc' },
            take: 200,
            select: {
                id: true,
                memberId: true,
                trainerId: true,
                date: true,
                duration: true,
                price: true,
                status: true,
                commissionPaid: true,
                materialsCost: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                member: true,
                trainer: { include: { classes: true } }
            }
        });
        res.json(sessions);
    } catch (e) {
        console.error("Fetch Sessions Error:", e);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
};

const getSessionById = async (req, res) => {
    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: Number(req.params.id) },
            select: {
                id: true,
                date: true,
                duration: true,
                price: true,
                status: true,
                commissionPaid: true,
                materialsCost: true,
                notes: true,
                createdAt: true,
                member: true,
                trainer: true,
                materials: true
            }
        });
        if (!session) return res.status(404).json({ error: "Session not found" });

        // Authorization check if Trainer
        if (req.user.role === 'TRAINER') {
            if (session.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }

        res.json(session);
    } catch (e) {
        console.error("Fetch Session Details Error:", e);
        res.status(500).json({ error: "Failed to fetch session details" });
    }
};

const completeSession = async (req, res) => {
    const { id } = req.params;
    const { materialsCost, notes, materials } = req.body;

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: Number(id) },
            include: { trainer: true }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Authorization check if Trainer
        if (req.user.role === 'TRAINER') {
            if (session.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        if (!canFinalizeAttendanceStatus(session.status)) {
            return res.status(400).json({ error: "Only scheduled or rescheduled sessions can be completed" });
        }

        const sessionStart = new Date(session.date);
        if (Number.isNaN(sessionStart.getTime())) {
            return res.status(400).json({ error: "Invalid session date" });
        }
        const sessionEndWithGrace = new Date(
            sessionStart.getTime() + ((Number(session.duration) || 0) + COMPLETE_GRACE_MINUTES) * 60 * 1000
        );
        if (new Date() < sessionEndWithGrace) {
            return res.status(400).json({
                error: `Session can be marked completed only after it ends (+${COMPLETE_GRACE_MINUTES} min grace period)`
            });
        }

        // Calculate total material cost if not provided manually
        let calculatedMatCost = parseFloat(materialsCost) || 0;

        // Process Materials (Inventory & Expense)
        if (materials && Array.isArray(materials) && materials.length > 0) {
            calculatedMatCost = 0; // Recalculate based on items

            for (const item of materials) {
                const itemCost = (parseFloat(item.cost) || 0) * (Number(item.quantity) || 1);
                calculatedMatCost += itemCost;

                // 1. Record Session Material Link
                await prisma.sessionMaterial.create({
                    data: {
                        sessionId: session.id,
                        productId: item.productId ? Number(item.productId) : null,
                        name: item.name,
                        category: item.category || 'OTHER',
                        quantity: Number(item.quantity) || 1,
                        costPerUnit: parseFloat(item.cost) || 0,
                        totalCost: itemCost
                    }
                });

                // 2. Decrement Stock if Product ID exists
                if (item.productId) {
                    await prisma.product.update({
                        where: { id: Number(item.productId) },
                        data: { stock: { decrement: Number(item.quantity) || 1 } }
                    });
                }

                // 3. Create Expense Record
                await prisma.expense.create({
                    data: {
                        title: `Session Material: ${item.name}`,
                        amount: itemCost,
                        category: 'SESSION_MATERIAL',
                        date: new Date(),
                        notes: `Used in session #${session.id} with ${session.trainer.name}`,
                        recordedBy: req.user.id.toString()
                    }
                });
            }
        } else if (calculatedMatCost > 0) {
            // Logic for manual cost entry without specific items
            await prisma.expense.create({
                data: {
                    title: `Session Material (Manual)`,
                    amount: calculatedMatCost,
                    category: 'SESSION_MATERIAL',
                    date: new Date(),
                    notes: `Used in session #${session.id} (Manual Entry)`,
                    recordedBy: req.user.id.toString()
                }
            });
        }

        /* 
        // 4. Process Commission - MOVED TO PAYROLL
        const commissionAmount = session.price * (session.trainer?.commissionRate || 0);
        if (commissionAmount > 0) {
            await prisma.expense.create({
                data: {
                    title: `Commission: ${session.trainer.name}`,
                    amount: commissionAmount,
                    category: 'SALARY',
                    date: new Date(),
                    notes: `Session #${session.id} - ${(session.trainer.commissionRate * 100).toFixed(0)}% of ${session.price}`,
                    recordedBy: req.user.id.toString(),
                    trainerId: session.trainerId
                }
            });
        }
        */
        const commissionAmount = session.price * (session.trainer?.commissionRate || 0);

        const updated = await prisma.trainingSession.update({
            where: { id: Number(id) },
            data: {
                status: 'COMPLETED',
                materialsCost: calculatedMatCost,
                notes: notes,
                commissionPaid: false // Will be paid via Payroll
            }
        });

        res.json(updated);
    } catch (e) {
        console.error("Complete Session Error:", e);
        res.status(500).json({ error: "Failed to complete session" });
    }
};

const updateSession = async (req, res) => {
    try {
        // Limited update (Date/Time/Duration/Notes)
        const sessionId = Number(req.params.id);
        const { date, time, duration, notes } = req.body;

        const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
        if (!session) return res.status(404).json({ error: "Session not found" });

        // Authorization check if Trainer
        if (req.user.role === 'TRAINER') {
            if (session.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        if (isSessionTerminal(session.status)) {
            return res.status(400).json({ error: "Cannot modify a completed, cancelled, or no-show session" });
        }
        if (new Date(session.date) < new Date()) {
            return res.status(400).json({ error: "Past sessions cannot be modified" });
        }

        let nextDateTime = session.date;
        if (date || time) {
            const current = new Date(session.date);
            const requestedDate = date || current.toISOString().split('T')[0];
            const requestedTime = time || `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
            const composed = new Date(`${requestedDate}T${requestedTime}`);
            if (isNaN(composed.getTime())) {
                return res.status(400).json({ error: "Invalid date or time" });
            }
            if (composed <= new Date()) {
                return res.status(400).json({ error: "Rescheduled time must be in the future" });
            }
            const composedDate = composed.toISOString().slice(0, 10);
            const composedTime = `${String(composed.getHours()).padStart(2, '0')}:${String(composed.getMinutes()).padStart(2, '0')}`;
            if (!isTimeAllowedForTrainer({
                trainerId: Number(session.trainerId),
                date: composedDate,
                time: composedTime,
                duration: Number(session.duration)
            })) {
                return res.status(400).json({ error: "Selected schedule is outside trainer availability" });
            }
            if (await checkBookingConflict(Number(session.trainerId), composed, Number(session.duration), session.id)) {
                return res.status(409).json({ error: "This time slot overlaps another session" });
            }
            nextDateTime = composed;
        }

        let nextDuration = session.duration;
        if (duration !== undefined && duration !== null && duration !== '') {
            const numeric = Number(duration);
            if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 480) {
                return res.status(400).json({ error: "Invalid duration" });
            }
            nextDuration = Math.round(numeric);
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                date: nextDateTime,
                duration: nextDuration,
                notes: notes !== undefined ? (notes || null) : session.notes,
                status: session.status === 'SCHEDULED' && (date || time) ? 'RESCHEDULED' : session.status
            }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update session", detail: e?.message });
    }
};

// Admin view of a trainer's sessions
const getTrainerSessions = async (req, res) => {
    try {
        const sessions = await prisma.trainingSession.findMany({
            where: { trainerId: Number(req.params.id) },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                memberId: true,
                trainerId: true,
                date: true,
                duration: true,
                price: true,
                status: true,
                commissionPaid: true,
                materialsCost: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                member: true
            }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions" });
    }
};

// Trainer's own sessions
const getMySessions = async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const sessions = await prisma.trainingSession.findMany({
            where: { trainerId: Number(trainerId) },
            include: { member: true },
            orderBy: { date: 'asc' }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions" });
    }
};

const cancelSession = async (req, res) => {
    const sessionId = Number(req.params.id);
    const user = req.user;

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        if (isSessionTerminal(session.status)) {
            return res.status(400).json({ error: "This session can no longer be cancelled" });
        }

        // 1. Check if session is in the past
        const now = new Date();
        if (new Date(session.date) < now) {
            return res.status(400).json({ error: "Cannot cancel past sessions" });
        }

        // 2. Check Permissions
        let isAuthorized = false;
        if (user.role === 'ADMIN' || user.role === 'STAFF' || user.role === 'OWNER') {
            isAuthorized = true;
        } else if (user.role === 'TRAINER') {
            // Trainers can only cancel sessions assigned to them
            if (session.trainerId === Number(user.trainerId)) isAuthorized = true;
        } else if (user.role === 'MEMBER') {
            // Members can only cancel their own sessions
            if (session.memberId === Number(user.id)) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: "You are not authorized to cancel this session" });
        }

        const hoursUntilSession = (new Date(session.date).getTime() - now.getTime()) / (1000 * 60 * 60);
        if (user.role === 'MEMBER' && hoursUntilSession < MEMBER_RESCHEDULE_NOTICE_HOURS) {
            return res.status(400).json({
                error: `Member cancellations require at least ${MEMBER_RESCHEDULE_NOTICE_HOURS} hours notice. Missed sessions are non-refundable by default.`
            });
        }

        // 3. Update Status
        await prisma.trainingSession.update({
            where: { id: sessionId },
            data: { status: 'CANCELLED' }
        });

        // 4. Return message
        let message = "Session cancelled successfully.";
        if (session.paymentStatus === 'PAID') {
            message += " Paid sessions are non-refundable by default unless approved as a refund exception by staff.";
        }

        res.json({ message, session: { ...session, status: 'CANCELLED' } });

    } catch (e) {
        console.error("Cancel Session Error:", e);
        res.status(500).json({ error: "Failed to cancel session" });
    }
};

const declineSession = async (req, res) => {
    const sessionId = Number(req.params.id);
    const { reason } = req.body || {};

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                status: 'DECLINED',
                notes: reason ? `Declined: ${reason}` : session.notes
            }
        });

        res.json(updated);
    } catch (e) {
        console.error("Decline Session Error:", e);
        res.status(500).json({ error: "Failed to decline session" });
    }
};

const memberRescheduleSession = async (req, res) => {
    const sessionId = Number(req.params.id);
    const { date, time, reason } = req.body || {};

    if (!date || !time) {
        return res.status(400).json({ error: "date and time are required" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        if (req.user.role !== 'MEMBER' || Number(req.user.id) !== Number(session.memberId)) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (isSessionTerminal(session.status)) {
            return res.status(400).json({ error: "This session can no longer be rescheduled" });
        }
        if (String(session.status).toUpperCase() === 'RESCHEDULED') {
            return res.status(400).json({ error: "This booking already used its one-time member reschedule" });
        }

        const now = new Date();
        const originalDate = new Date(session.date);
        const hoursUntilOriginal = (originalDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilOriginal < MEMBER_RESCHEDULE_NOTICE_HOURS) {
            return res.status(400).json({
                error: `Reschedule requires at least ${MEMBER_RESCHEDULE_NOTICE_HOURS} hours notice before session start`
            });
        }

        const nextDateTime = new Date(`${date}T${time}`);
        if (Number.isNaN(nextDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date/time" });
        }
        if (nextDateTime <= now) {
            return res.status(400).json({ error: "New schedule must be in the future" });
        }

        const maxRescheduleDate = new Date(originalDate);
        maxRescheduleDate.setDate(maxRescheduleDate.getDate() + MEMBER_RESCHEDULE_WINDOW_DAYS);
        if (nextDateTime > maxRescheduleDate) {
            return res.status(400).json({
                error: `Rescheduled date must be within ${MEMBER_RESCHEDULE_WINDOW_DAYS} days from the original session`
            });
        }

        const hhmm = `${String(nextDateTime.getHours()).padStart(2, '0')}:${String(nextDateTime.getMinutes()).padStart(2, '0')}`;
        const yyyyMmDd = nextDateTime.toISOString().slice(0, 10);
        if (!isTimeAllowedForTrainer({
            trainerId: Number(session.trainerId),
            date: yyyyMmDd,
            time: hhmm,
            duration: Number(session.duration)
        })) {
            return res.status(400).json({ error: "Selected schedule is outside trainer availability" });
        }

        if (await checkBookingConflict(Number(session.trainerId), nextDateTime, Number(session.duration), session.id)) {
            return res.status(409).json({ error: "This time slot overlaps another session" });
        }

        const update = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                date: nextDateTime,
                status: 'RESCHEDULED',
                notes: appendPolicyNote(
                    session.notes,
                    `Member rescheduled (${new Date().toISOString()}) from ${originalDate.toISOString()} to ${nextDateTime.toISOString()}${reason ? ` | reason: ${String(reason).trim()}` : ''}`
                )
            }
        });

        res.json({
            message: "Session rescheduled successfully. No-refund policy still applies to future no-shows.",
            session: update
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to reschedule session", detail: e?.message });
    }
};

const markNoShow = async (req, res) => {
    const sessionId = Number(req.params.id);
    const { note } = req.body || {};

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        const user = req.user;
        let authorized = ['ADMIN', 'STAFF', 'OWNER'].includes(user.role);
        if (!authorized && user.role === 'TRAINER' && session.trainerId === Number(user.trainerId)) {
            authorized = true;
        }
        if (!authorized) {
            return res.status(403).json({ error: "Not authorized to mark this session as no-show" });
        }
        if (!canFinalizeAttendanceStatus(session.status)) {
            return res.status(400).json({ error: "Only scheduled or rescheduled sessions can be marked as no-show" });
        }
        const sessionStart = new Date(session.date);
        if (Number.isNaN(sessionStart.getTime())) {
            return res.status(400).json({ error: "Invalid session date" });
        }
        const noShowEligibleAt = new Date(sessionStart.getTime() + (NO_SHOW_GRACE_MINUTES * 60 * 1000));
        if (new Date() < noShowEligibleAt) {
            return res.status(400).json({
                error: `No-show can only be marked ${NO_SHOW_GRACE_MINUTES} minutes after session start`
            });
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                status: 'NO_SHOW',
                notes: appendPolicyNote(
                    session.notes,
                    `Marked NO_SHOW by ${user.role}#${user.id} at ${new Date().toISOString()}${note ? ` | ${String(note).trim()}` : ''}`
                )
            }
        });

        res.json({
            message: "Session marked as NO_SHOW. No refund is issued by default.",
            session: updated
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to mark no-show", detail: e?.message });
    }
};

const requestRefundException = async (req, res) => {
    const sessionId = Number(req.params.id);
    const { reason, details } = req.body || {};
    const normalizedReason = String(reason || '').trim().toUpperCase();
    const allowedReasons = ['TRAINER_ABSENT', 'GYM_CLOSURE', 'SYSTEM_ERROR', 'MEDICAL_EMERGENCY', 'OTHER'];

    if (!allowedReasons.includes(normalizedReason)) {
        return res.status(400).json({ error: `reason must be one of: ${allowedReasons.join(', ')}` });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        const user = req.user;
        let authorized = ['ADMIN', 'STAFF', 'OWNER'].includes(user.role);
        if (!authorized && user.role === 'TRAINER' && session.trainerId === Number(user.trainerId)) {
            authorized = true;
        }
        if (!authorized) {
            return res.status(403).json({ error: "Not authorized to request refund exception" });
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                notes: appendPolicyNote(
                    session.notes,
                    `REFUND_EXCEPTION_REQUESTED by ${user.role}#${user.id} at ${new Date().toISOString()} | reason=${normalizedReason}${details ? ` | details=${String(details).trim()}` : ''}`
                )
            }
        });

        res.json({
            message: "Refund exception request logged. Staff/owner approval is required before any refund action.",
            session: updated
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to request refund exception", detail: e?.message });
    }
};


module.exports = {
    getAllSessions,
    getSessionById,
    completeSession,
    updateSession,
    getTrainerSessions,
    getMySessions,
    cancelSession,
    declineSession,
    memberRescheduleSession,
    markNoShow,
    requestRefundException
};
