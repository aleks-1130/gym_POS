const prisma = require('../../config/prisma');
const { isTimeAllowedForTrainer } = require('../../services/trainerAvailabilityService');

const MEMBER_RESCHEDULE_NOTICE_HOURS = 24;
const MEMBER_RESCHEDULE_WINDOW_DAYS = 7;
const COMPLETE_GRACE_MINUTES = 5;
const NO_SHOW_GRACE_MINUTES = COMPLETE_GRACE_MINUTES;
const NO_SHOW_ACTION_WINDOW_HOURS = 24;
const NO_SHOW_ACTION_WINDOW_MS = NO_SHOW_ACTION_WINDOW_HOURS * 60 * 60 * 1000;
const FINALIZED_SESSION_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'DECLINED'];

const toLocalIsoDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const appendPolicyNote = (existingNotes, extraLine) => {
    const base = (existingNotes || '').trim();
    return [base, extraLine].filter(Boolean).join('\n');
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
            latestRequest = line;
        }
        if (line.startsWith('REFUND_EXCEPTION_APPROVED') || line.startsWith('REFUND_EXCEPTION_REJECTED')) {
            latestResolution = line;
        }
    }

    return {
        hasRequest: Boolean(latestRequest),
        isResolved: Boolean(latestResolution),
        status: !latestRequest ? 'NONE' : (latestResolution ? (latestResolution.startsWith('REFUND_EXCEPTION_APPROVED') ? 'APPROVED' : 'REJECTED') : 'PENDING')
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
            latestRequest = line;
        }
        if (line.startsWith('TRAINER_CHANGE_RESOLVED')) {
            latestResolution = line;
        }
    }

    return {
        hasRequest: Boolean(latestRequest),
        isResolved: Boolean(latestResolution),
        status: !latestRequest ? 'NONE' : (latestResolution ? 'RESOLVED' : 'PENDING')
    };
};

const parseNoShowMarkedAt = (session) => {
    const lines = String(session?.notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    let parsed = null;
    for (const line of lines) {
        if (!line.startsWith('Marked NO_SHOW')) continue;
        const atMatch = line.match(/ at ([^|]+)/);
        if (!atMatch?.[1]) continue;
        const timestamp = new Date(atMatch[1].trim());
        if (!Number.isNaN(timestamp.getTime())) {
            parsed = timestamp;
        }
    }

    if (parsed) return parsed;

    const fallbackUpdated = session?.updatedAt ? new Date(session.updatedAt) : null;
    if (fallbackUpdated && !Number.isNaN(fallbackUpdated.getTime())) return fallbackUpdated;
    const fallbackDate = session?.date ? new Date(session.date) : null;
    if (fallbackDate && !Number.isNaN(fallbackDate.getTime())) return fallbackDate;
    return null;
};

const getNoShowActionWindowState = (session, now = new Date()) => {
    const noShowMarkedAt = parseNoShowMarkedAt(session);
    if (!noShowMarkedAt) {
        return {
            noShowMarkedAt: null,
            expiresAt: null,
            isOpen: false
        };
    }
    const expiresAt = new Date(noShowMarkedAt.getTime() + NO_SHOW_ACTION_WINDOW_MS);
    return {
        noShowMarkedAt,
        expiresAt,
        isOpen: now <= expiresAt
    };
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
            status: { notIn: FINALIZED_SESSION_STATUSES },
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

const getTrainerUserId = async (trainerId) => {
    if (!Number.isInteger(Number(trainerId))) return null;
    const trainerUser = await prisma.user.findFirst({
        where: { trainerId: Number(trainerId) },
        select: { id: true }
    });
    return trainerUser ? Number(trainerUser.id) : null;
};

const getAllSessions = async (req, res) => {
    try {
        const sessions = await prisma.trainingSession.findMany({
            orderBy: { date: 'desc' },
            where: {
                tenantId: Number(req.user.tenantId),
                gymId: req.user.role === 'OWNER' ? undefined : Number(req.gymId || req.user.gymId)
            },
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
        res.status(500).json({ error: "Failed to fetch sessions", detail: e?.message });
    }
};

const getSessionById = async (req, res) => {
    try {
        const session = await prisma.trainingSession.findUnique({
            where: { 
                id: Number(req.params.id),
                tenantId: Number(req.user.tenantId)
            },
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
            where: { 
                id: Number(id),
                tenantId: Number(req.user.tenantId)
            },
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

        const trainerUserId = await getTrainerUserId(session.trainerId);

        // Process Materials (Inventory & Expense)
        // --- Atomic transaction: all DB writes succeed or all roll back ---
        const updated = await prisma.$transaction(async (tx) => {
            if (materials && Array.isArray(materials) && materials.length > 0) {
                calculatedMatCost = 0; // Recalculate based on items

                for (const item of materials) {
                    const sourcePaymentItemId = item.sourcePaymentItemId ? Number(item.sourcePaymentItemId) : null;
                    const requestedQty = Number(item.quantity) || 1;
                    if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
                        return res.status(400).json({ error: "Invalid material quantity" });
                    }

                    let resolvedProductId = item.productId ? Number(item.productId) : null;
                    let resolvedName = item.name;
                    let resolvedCategory = item.category || 'OTHER';
                    let resolvedCostPerUnit = parseFloat(item.cost) || 0;
                    let shouldDecrementStock = Boolean(resolvedProductId);

                    if (sourcePaymentItemId) {
                        const sourcePaymentItem = await prisma.paymentItem.findUnique({
                            where: { id: sourcePaymentItemId },
                            include: {
                                product: { select: { category: true, supplyCost: true } },
                                payment: { select: { cashierId: true, status: true } }
                            }
                        });
                        if (!sourcePaymentItem || !sourcePaymentItem.intendedForSessionMaterial) {
                            return res.status(400).json({ error: "Selected material source is invalid" });
                        }
                        const sourcePaymentStatus = String(sourcePaymentItem.payment?.status || '').toUpperCase();
                        const sourcePaymentMethod = String(sourcePaymentItem.payment?.method || '').toUpperCase();
                        const canUseDeferredMaterial = sourcePaymentMethod === 'COMMISSION_DEDUCTION' && sourcePaymentStatus === 'PENDING';
                        if (sourcePaymentStatus !== 'COMPLETED' && !canUseDeferredMaterial) {
                            return res.status(400).json({ error: "Only completed purchases or deferred commission-deduction purchases can be used as materials" });
                        }
                        if (!trainerUserId || Number(sourcePaymentItem.payment?.cashierId) !== Number(trainerUserId)) {
                            return res.status(403).json({ error: "Material source does not belong to this trainer" });
                        }

                        const availableFromSource = Number(sourcePaymentItem.quantity || 0) - Number(sourcePaymentItem.returnedQuantity || 0) - Number(sourcePaymentItem.materialUsedQuantity || 0);
                        if (requestedQty > availableFromSource) {
                            return res.status(400).json({ error: `Only ${Math.max(availableFromSource, 0)} unit(s) available from selected purchase` });
                        }

                        resolvedProductId = sourcePaymentItem.productId ? Number(sourcePaymentItem.productId) : null;
                        resolvedName = sourcePaymentItem.name || resolvedName;
                        resolvedCategory = sourcePaymentItem.product?.category || resolvedCategory;
                        // Use unitPrice (what the trainer paid at retail) for commission deduction,
                        // NOT supplyCost (the gym's internal wholesale cost basis)
                        resolvedCostPerUnit = Number(sourcePaymentItem.unitPrice || resolvedCostPerUnit || 0);
                        shouldDecrementStock = false; // Stock already decremented at purchase time

                        await tx.paymentItem.update({
                            where: { id: sourcePaymentItemId },
                            data: { materialUsedQuantity: { increment: requestedQty } }
                        });
                    }

                    const itemCost = (resolvedCostPerUnit || 0) * requestedQty;
                    calculatedMatCost += itemCost;

                    // 1. Record Session Material Link
                    await tx.sessionMaterial.create({
                        data: {
                            sessionId: session.id,
                            productId: resolvedProductId,
                            name: resolvedName,
                            category: resolvedCategory,
                            quantity: requestedQty,
                            costPerUnit: resolvedCostPerUnit || 0,
                            totalCost: itemCost
                        }
                    });

                    if (shouldDecrementStock && resolvedProductId) {
                        const decremented = await tx.product.updateMany({
                            where: {
                                id: Number(resolvedProductId),
                                stock: { gte: requestedQty }
                            },
                            data: { stock: { decrement: requestedQty } }
                        });
                        if (decremented.count === 0) {
                            throw new Error(`Insufficient stock for ${resolvedName || 'product'}`);
                        }
                    }

                    // 3. Create Expense Record
                    await tx.expense.create({
                        data: {
                            title: `Session Material: ${resolvedName}`,
                            amount: itemCost,
                            category: 'SESSION_MATERIAL',
                            date: new Date(),
                            notes: `Used in session #${session.id} with ${session.trainer.name}`,
                            recordedBy: req.user.id.toString(),
                            gymId: session.gymId || req.user.gymId,
                            tenantId: session.tenantId || req.user.tenantId
                        }
                    });
                }
            } else if (calculatedMatCost > 0) {
                // Logic for manual cost entry without specific items
                await tx.expense.create({
                    data: {
                        title: `Session Material (Manual)`,
                        amount: calculatedMatCost,
                        category: 'SESSION_MATERIAL',
                        date: new Date(),
                        notes: `Used in session #${session.id} (Manual Entry)`,
                        recordedBy: req.user.id.toString(),
                        gymId: session.gymId || req.user.gymId,
                        tenantId: session.tenantId || req.user.tenantId
                    }
                });
            }

            // 5. Mark session as COMPLETED (final step — only reached if all above succeed)
            return tx.trainingSession.update({
                where: { id: Number(id) },
                data: {
                    status: 'COMPLETED',
                    materialsCost: calculatedMatCost,
                    notes: notes,
                    commissionPaid: false
                }
            });
        }); // end prisma.$transaction

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

        const session = await prisma.trainingSession.findUnique({ 
            where: { 
                id: sessionId,
                tenantId: Number(req.user.tenantId)
            } 
        });
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
            const allowClosedBookingToday = await shouldTemporarilyOpenTrainerForDate({
                trainerId: Number(session.trainerId),
                date: composedDate
            });
            if (!(await isTimeAllowedForTrainer({
                trainerId: Number(session.trainerId),
                date: composedDate,
                time: composedTime,
                duration: Number(session.duration),
                enforceBookingStatus: !allowClosedBookingToday
            }))) {
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
            where: { 
                trainerId: Number(req.params.id),
                tenantId: Number(req.user.tenantId)
            },
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
            where: { 
                id: sessionId,
                tenantId: Number(req.user.tenantId)
            }
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
        if (user.role === 'MEMBER' && String(session.paymentStatus || '').toUpperCase() === 'PAID') {
            return res.status(400).json({
                error: "Paid sessions cannot be cancelled directly. Submit a cancellation refund request for staff/admin approval."
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
            where: { 
                id: sessionId,
                tenantId: Number(req.user.tenantId)
            }
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

const getSessionMaterialCandidates = async (req, res) => {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { 
                id: sessionId,
                tenantId: Number(req.user.tenantId)
            },
            select: { id: true, trainerId: true }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        if (req.user.role === 'TRAINER' && Number(req.user.trainerId) !== Number(session.trainerId)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const trainerUserId = await getTrainerUserId(session.trainerId);
        if (!trainerUserId) {
            return res.json([]);
        }

        const items = await prisma.paymentItem.findMany({
            where: {
                type: 'PRODUCT',
                intendedForSessionMaterial: true,
                payment: {
                    cashierId: trainerUserId,
                    OR: [
                        { status: 'COMPLETED' },
                        { status: 'PENDING', method: 'COMMISSION_DEDUCTION' }
                    ],
                    type: { in: ['STORE_SALE', 'IN_APP_PURCHASE'] }
                }
            },
            include: {
                product: { select: { category: true, supplyCost: true } },
                payment: {
                    select: {
                        id: true,
                        date: true,
                        method: true,
                        status: true
                    }
                }
            },
            orderBy: [{ payment: { date: 'desc' } }, { id: 'desc' }]
        });

        const candidates = items
            .map((item) => {
                const availableQuantity = Number(item.quantity || 0) - Number(item.returnedQuantity || 0) - Number(item.materialUsedQuantity || 0);
                // Use unitPrice (what the trainer paid at retail) for deduction display,
                // NOT supplyCost (the gym's internal wholesale cost basis)
                const derivedCost = Number(item.unitPrice || 0);
                return {
                    paymentItemId: item.id,
                    paymentId: item.paymentId,
                    name: item.name,
                    productId: item.productId,
                    category: item.product?.category || 'OTHER',
                    costPerUnit: derivedCost,
                    availableQuantity,
                    purchasedAt: item.payment?.date || null,
                    paymentMethod: item.payment?.method || null
                };
            })
            .filter((item) => item.availableQuantity > 0);

        return res.json(candidates);
    } catch (e) {
        return res.status(500).json({ error: "Failed to fetch material candidates", detail: e?.message });
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
        const allowClosedBookingToday = await shouldTemporarilyOpenTrainerForDate({
            trainerId: Number(session.trainerId),
            date: yyyyMmDd
        });
        if (!(await isTimeAllowedForTrainer({
            trainerId: Number(session.trainerId),
            date: yyyyMmDd,
            time: hhmm,
            duration: Number(session.duration),
            enforceBookingStatus: !allowClosedBookingToday
        }))) {
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
        const noShowEligibleAt = new Date(
            sessionStart.getTime() + ((Number(session.duration) || 0) + NO_SHOW_GRACE_MINUTES) * 60 * 1000
        );
        if (new Date() < noShowEligibleAt) {
            return res.status(400).json({
                error: `No-show can be marked only after session ends (+${NO_SHOW_GRACE_MINUTES} min grace period)`
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

const requestNoShowAction = async (req, res) => {
    const sessionId = Number(req.params.id);
    const action = String(req.body?.action || '').trim().toUpperCase();
    const details = String(req.body?.details || '').trim();
    const preferredDate = String(req.body?.preferredDate || '').trim();
    const preferredTime = String(req.body?.preferredTime || '').trim();

    if (!['REFUND', 'RESCHEDULE'].includes(action)) {
        return res.status(400).json({ error: "action must be REFUND or RESCHEDULE" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        if (req.user.role !== 'MEMBER' || Number(req.user.id) !== Number(session.memberId)) {
            return res.status(403).json({ error: "Not authorized to request action for this session" });
        }

        const status = String(session.status || '').toUpperCase();
        if (status !== 'NO_SHOW') {
            return res.status(400).json({ error: "Only NO_SHOW sessions can request refund/reschedule review" });
        }

        const window = getNoShowActionWindowState(session);
        if (!window.isOpen) {
            return res.status(400).json({
                error: `No-show action window has expired. Requests must be submitted within ${NO_SHOW_ACTION_WINDOW_HOURS} hours.`
            });
        }

        const refundMeta = parseRefundExceptionMeta(session.notes);
        const changeMeta = parseTrainerChangeRequestMeta(session.notes);
        if (refundMeta.hasRequest || changeMeta.hasRequest) {
            return res.status(400).json({ error: "An action request for this no-show session already exists." });
        }

        let line = '';
        if (action === 'REFUND') {
            line = `REFUND_EXCEPTION_REQUESTED by MEMBER#${req.user.id} at ${new Date().toISOString()} | reason=MEMBER_NO_SHOW${details ? ` | details=${details}` : ''}`;
        } else {
            let preferredSegment = '';
            if ((preferredDate && !preferredTime) || (!preferredDate && preferredTime)) {
                return res.status(400).json({ error: "preferredDate and preferredTime must be provided together" });
            }
            if (preferredDate && preferredTime) {
                const preferredDateTime = new Date(`${preferredDate}T${preferredTime}`);
                if (Number.isNaN(preferredDateTime.getTime())) {
                    return res.status(400).json({ error: "Invalid preferred date/time" });
                }
                preferredSegment = ` | preferred=${preferredDate}T${preferredTime}`;
            }
            line = `TRAINER_CHANGE_REQUESTED by MEMBER#${req.user.id} at ${new Date().toISOString()} | reason=MEMBER_NO_SHOW_RESCHEDULE${preferredSegment}`;
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                notes: appendPolicyNote(session.notes, line)
            }
        });

        return res.json({
            message: action === 'REFUND'
                ? "Refund request submitted to staff/admin for approval."
                : "Reschedule request submitted to staff/admin for approval.",
            expiresAt: window.expiresAt,
            session: updated
        });
    } catch (e) {
        return res.status(500).json({ error: "Failed to submit no-show action request", detail: e?.message });
    }
};

const requestRefundException = async (req, res) => {
    const sessionId = Number(req.params.id);
    const { reason, details } = req.body || {};
    const normalizedReason = String(reason || '').trim().toUpperCase();
    const allowedReasons = ['TRAINER_ABSENT', 'GYM_CLOSURE', 'SYSTEM_ERROR', 'MEDICAL_EMERGENCY', 'MEMBER_CANCEL_PAID', 'OTHER'];

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
        if (isSessionTerminal(session.status)) {
            return res.status(400).json({ error: "This session is already finalized" });
        }

        const user = req.user;
        let authorized = ['ADMIN', 'STAFF', 'OWNER'].includes(user.role);
        if (!authorized && user.role === 'TRAINER' && session.trainerId === Number(user.trainerId)) {
            authorized = true;
        }
        if (!authorized && user.role === 'MEMBER' && Number(session.memberId) === Number(user.id)) {
            authorized = true;
        }
        if (!authorized) {
            return res.status(403).json({ error: "Not authorized to request refund exception" });
        }

        if (user.role === 'MEMBER') {
            if (normalizedReason !== 'MEMBER_CANCEL_PAID') {
                return res.status(400).json({ error: "Members can only request paid cancellation review using reason MEMBER_CANCEL_PAID" });
            }
            if (String(session.paymentStatus || '').toUpperCase() !== 'PAID') {
                return res.status(400).json({ error: "Only paid sessions can request paid cancellation review" });
            }
            if (new Date(session.date) < new Date()) {
                return res.status(400).json({ error: "Paid cancellation review is only available before the session start time" });
            }
            const hoursUntilSession = (new Date(session.date).getTime() - Date.now()) / (1000 * 60 * 60);
            if (hoursUntilSession < MEMBER_RESCHEDULE_NOTICE_HOURS) {
                return res.status(400).json({
                    error: `Paid cancellation review requests require at least ${MEMBER_RESCHEDULE_NOTICE_HOURS} hours notice before session start`
                });
            }
        }

        const refundMeta = parseRefundExceptionMeta(session.notes);
        if (refundMeta.hasRequest && !refundMeta.isResolved) {
            return res.status(400).json({ error: "A refund/cancellation request is already pending for this session" });
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
            message: user.role === 'MEMBER'
                ? "Paid cancellation refund request submitted to staff/admin for approval."
                : "Refund exception request logged. Staff/owner approval is required before any refund action.",
            session: updated
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to request refund exception", detail: e?.message });
    }
};

const requestUnableToAttend = async (req, res) => {
    const sessionId = Number(req.params.id);
    const { reason, preferredDate, preferredTime } = req.body || {};
    const normalizedReason = String(reason || '').trim();

    if (!normalizedReason) {
        return res.status(400).json({ error: "reason is required" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        if (req.user.role !== 'TRAINER' || Number(req.user.trainerId) !== Number(session.trainerId)) {
            return res.status(403).json({ error: "Not authorized to request change for this session" });
        }
        if (isSessionTerminal(session.status)) {
            return res.status(400).json({ error: "This session is already finalized" });
        }
        if (new Date(session.date) < new Date()) {
            return res.status(400).json({ error: "Cannot create trainer change request for past sessions" });
        }
        if (String(session.status).toUpperCase() === 'RESCHEDULE_REQUESTED') {
            return res.status(400).json({ error: "A trainer change request is already pending for this session" });
        }

        const preferredSegment = preferredDate && preferredTime
            ? ` | preferred=${preferredDate}T${preferredTime}`
            : '';
        const line = `TRAINER_CHANGE_REQUESTED by TRAINER#${req.user.id} at ${new Date().toISOString()} | reason=${normalizedReason}${preferredSegment}`;

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                status: 'RESCHEDULE_REQUESTED',
                notes: appendPolicyNote(session.notes, line)
            }
        });

        res.json({
            message: "Request submitted to staff/admin for approval.",
            session: updated
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to submit trainer change request", detail: e?.message });
    }
};


module.exports = {
    getAllSessions,
    getSessionById,
    getSessionMaterialCandidates,
    completeSession,
    updateSession,
    getTrainerSessions,
    getMySessions,
    cancelSession,
    declineSession,
    memberRescheduleSession,
    markNoShow,
    requestNoShowAction,
    requestRefundException,
    requestUnableToAttend
};
