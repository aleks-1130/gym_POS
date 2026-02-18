const prisma = require('../config/prisma');
const { isTimeAllowedForTrainer } = require('../services/trainerAvailabilityService');

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

        const where = { status: { not: 'DELETED' } };

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
            const [members, total] = await Promise.all([
                prisma.member.findMany({
                    ...queryOptions,
                    skip,
                    take: limit
                }),
                prisma.member.count({ where: queryOptions.where })
            ]);

            return res.json({
                data: members,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
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
        const [member, classes] = await Promise.all([
            prisma.member.findUnique({
                where: { id: memberId },
                include: { plan: true }
            }),
            prisma.class.findMany({
                include: {
                    trainer: true,
                    bookings: {
                        where: { memberId }
                    }
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
        const classesWithBooking = classes.map(c => ({
            ...c,
            isBooked: c.bookings.length > 0
        }));

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
    const { classId } = req.body;
    const memberId = Number(req.user.id);

    // Safety check: Ensure user is a member
    if (req.user.role !== 'MEMBER') return res.status(403).json({ error: "Only members can book classes" });

    try {
        const parsedClassId = Number(classId);
        if (!Number.isInteger(parsedClassId)) {
            return res.status(400).json({ error: "Invalid class ID" });
        }

        const bookingResult = await prisma.$transaction(async (tx) => {
            const [member, cls] = await Promise.all([
                tx.member.findUnique({ where: { id: memberId } }),
                tx.class.findUnique({ where: { id: parsedClassId } })
            ]);

            if (!member) {
                return { error: "Member profile not found", status: 404 };
            }
            if (!cls) {
                return { error: "Class not found", status: 404 };
            }
            if (Number(member.classSessionsRemaining || 0) <= 0) {
                return {
                    error: "No class sessions remaining. Please purchase a class session package.",
                    status: 400
                };
            }
            if (cls.enrolled >= cls.capacity) {
                return { error: "Class is full", status: 400 };
            }

            const existing = await tx.booking.findFirst({
                where: { memberId, classId: parsedClassId, status: 'CONFIRMED' }
            });
            if (existing) {
                return { error: "Already booked", status: 400 };
            }

            await tx.booking.create({
                data: { memberId, classId: parsedClassId, status: 'CONFIRMED' }
            });
            await tx.class.update({
                where: { id: parsedClassId },
                data: { enrolled: { increment: 1 } }
            });
            await tx.member.update({
                where: { id: memberId },
                data: {
                    classSessionsRemaining: { decrement: 1 },
                    classSessionsUsed: { increment: 1 }
                }
            });

            return { success: true };
        });

        if (!bookingResult.success) {
            return res.status(bookingResult.status || 400).json({ error: bookingResult.error || "Booking failed" });
        }

        res.json({ message: "Booking confirmed" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Cancel Booking
const cancelBooking = async (req, res) => {
    const { classId } = req.body;
    const memberId = Number(req.user.id);

    try {
        const parsedClassId = Number(classId);
        if (!Number.isInteger(parsedClassId)) {
            return res.status(400).json({ error: "Invalid class ID" });
        }

        const cancelResult = await prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({
                where: { memberId, classId: parsedClassId, status: 'CONFIRMED' }
            });

            if (!booking) {
                return { error: "Booking not found", status: 404 };
            }

            await tx.booking.delete({ where: { id: booking.id } });
            await tx.class.update({
                where: { id: parsedClassId },
                data: { enrolled: { decrement: 1 } }
            });
            await tx.member.update({
                where: { id: memberId },
                data: {
                    classSessionsRemaining: { increment: 1 },
                    classSessionsUsed: { decrement: 1 }
                }
            });

            return { success: true };
        });

        if (!cancelResult.success) {
            return res.status(cancelResult.status || 400).json({ error: cancelResult.error || "Cancellation failed" });
        }

        res.json({ message: "Booking cancelled" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Helper to check for booking conflicts
const checkBookingConflict = async (trainerId, startDateTime, durationMinutes) => {
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

    // Define the range for the entire day to fetch relevant sessions
    const startOfDay = new Date(startDateTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const conflictingSessions = await prisma.trainingSession.findMany({
        where: {
            trainerId: Number(trainerId),
            date: {
                gte: startOfDay,
                lt: endOfDay
            },
            status: { not: 'CANCELLED' }
        }
    });

    return conflictingSessions.some(session => {
        const sessionStart = new Date(session.date);
        const sessionEnd = new Date(sessionStart.getTime() + session.duration * 60000);
        return startDateTime < sessionEnd && endDateTime > sessionStart;
    });
};

// Book a Trainer Session (Member)
const bookTraining = async (req, res) => {
    const { trainerId, date, time, duration, notes, method } = req.body;
    const memberId = req.user.id;

    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can book trainer sessions from this endpoint" });
    }

    if (!trainerId || !date || !time || !duration || !method) {
        return res.status(400).json({ error: "Missing required booking details" });
    }
    const allowedMethods = ['CASH', 'CARD', 'GCASH'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const member = await prisma.member.findUnique({ where: { id: Number(memberId) } });
        if (!member) {
            return res.status(404).json({ error: "Member profile not found. Please log in again as a member." });
        }

        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        const startDateTime = new Date(`${date}T${time}`);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date or time" });
        }
        if (!isTimeAllowedForTrainer({ trainerId: Number(trainerId), date, time, duration: Number(duration) })) {
            return res.status(400).json({ error: "Selected schedule is outside trainer availability" });
        }

        // Check for conflicts
        if (await checkBookingConflict(Number(trainerId), startDateTime, Number(duration))) {
            return res.status(409).json({ error: "This time slot is already booked by another member" });
        }

        const allowedDurations = (trainer.sessionDurations || '60')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
        if (!allowedDurations.includes(Number(duration))) {
            return res.status(400).json({ error: "Selected duration not available" });
        }

        const sessionRate = trainer.sessionPrice ?? 300;
        const totalAmount = (Number(duration) / 60) * Number(sessionRate);

        await prisma.$transaction(async (tx) => {
            await tx.trainingSession.create({
                data: {
                    memberId,
                    trainerId: Number(trainerId),
                    date: startDateTime,
                    duration: Number(duration),
                    price: totalAmount,
                    status: 'SCHEDULED',
                    paymentStatus: method === 'CASH' ? 'UNPAID' : 'PAID',
                    paymentMethod: method,
                    paidAt: method === 'CASH' ? null : new Date(),
                    notes: notes || null
                }
            });

            if (method !== 'CASH') {
                await createPaymentCompat(tx, {
                    amount: totalAmount,
                    type: 'TRAINING',
                    method,
                    status: 'COMPLETED',
                    memberId
                });
            }

        });

        res.json({ message: method === 'CASH' ? "Training session booked. Pay at the front desk." : "Training session booked and paid" });
    } catch (e) {
        res.status(500).json({ error: "Failed to book training session", detail: e?.message });
    }
};

// Book a Trainer Session (Cash, Unpaid) - Authenticated members only
const bookTrainingCash = async (req, res) => {
    const { trainerId, date, time, duration, notes } = req.body;
    const resolvedMemberId = req.user.id;

    if (req.user.role !== 'MEMBER') {
        return res.status(403).json({ error: "Only member accounts can book trainer sessions from this endpoint" });
    }

    if (!trainerId || !date || !time || !duration) {
        return res.status(400).json({ error: "Missing required booking details" });
    }

    try {
        const member = await prisma.member.findUnique({ where: { id: Number(resolvedMemberId) } });
        if (!member) {
            return res.status(404).json({ error: "Member profile not found. Please log in again as a member." });
        }

        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        const startDateTime = new Date(`${date}T${time}`);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date or time" });
        }
        if (!isTimeAllowedForTrainer({ trainerId: Number(trainerId), date, time, duration: Number(duration) })) {
            return res.status(400).json({ error: "Selected schedule is outside trainer availability" });
        }

        // Check for conflicts
        if (await checkBookingConflict(Number(trainerId), startDateTime, Number(duration))) {
            return res.status(409).json({ error: "This time slot is already booked by another member" });
        }

        const allowedDurations = (trainer.sessionDurations || '60')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
        if (!allowedDurations.includes(Number(duration))) {
            return res.status(400).json({ error: "Selected duration not available" });
        }

        const sessionRate = trainer.sessionPrice ?? 300;
        const totalAmount = (Number(duration) / 60) * Number(sessionRate);

        await prisma.$transaction(async (tx) => {
            await tx.trainingSession.create({
                data: {
                    memberId: resolvedMemberId,
                    trainerId: Number(trainerId),
                    date: startDateTime,
                    duration: Number(duration),
                    price: totalAmount,
                    status: 'SCHEDULED',
                    paymentStatus: 'UNPAID',
                    paymentMethod: 'CASH',
                    paidAt: null,
                    notes: notes || null
                }
            });

        });

        res.json({ message: "Training session booked. Pay at the front desk." });
    } catch (e) {
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
                        imageUrl: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions", detail: e?.message });
    }
};

// Member Payment Methods
const getPaymentMethods = async (req, res) => {
    const memberId = Number(req.params.id);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    try {
        const methods = await prisma.paymentMethod.findMany({
            where: { memberId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(methods);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const addPaymentMethod = async (req, res) => {
    const memberId = Number(req.params.id);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    const { type, label, name, phone, brand, last4, expMonth, expYear, isDefault } = req.body;
    if (!type || !label) return res.status(400).json({ error: "Type and label are required" });
    if (!['GCASH', 'CARD'].includes(type)) return res.status(400).json({ error: "Invalid payment method type" });

    try {
        const existingCount = await prisma.paymentMethod.count({ where: { memberId } });
        const makeDefault = isDefault || existingCount === 0;

        const [method] = await prisma.$transaction([
            ...(makeDefault
                ? [prisma.paymentMethod.updateMany({ where: { memberId }, data: { isDefault: false } })]
                : []),
            prisma.paymentMethod.create({
                data: {
                    memberId,
                    type,
                    label,
                    name: name || null,
                    phone: phone || null,
                    brand: brand || null,
                    last4: last4 || null,
                    expMonth: expMonth || null,
                    expYear: expYear || null,
                    isDefault: makeDefault
                }
            })
        ]);

        res.json(method);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updatePaymentMethod = async (req, res) => {
    const memberId = Number(req.params.id);
    const methodId = Number(req.params.methodId);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    const { isDefault, label } = req.body;
    try {
        const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
        if (!method || method.memberId !== memberId) return res.status(404).json({ error: "Payment method not found" });

        if (isDefault) {
            await prisma.$transaction([
                prisma.paymentMethod.updateMany({ where: { memberId }, data: { isDefault: false } }),
                prisma.paymentMethod.update({ where: { id: methodId }, data: { isDefault: true } })
            ]);
            const updated = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
            return res.json(updated);
        }

        const updated = await prisma.paymentMethod.update({
            where: { id: methodId },
            data: { label: label || method.label }
        });
        res.json(updated);
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
        if (!['CASH', 'CARD', 'GCASH'].includes(String(paymentMethod).toUpperCase())) {
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
        if (method === 'GCASH' && !gcashReference) {
            return res.status(400).json({ error: "GCash reference is required for GCash payments" });
        }

        const { member, payment } = await prisma.$transaction(async (tx) => {
            const createdMember = await tx.member.create({
                data: {
                    firstName, lastName, email, phone, planId: Number(planId),
                    imageUrl,
                    birthDate: birthDate ? new Date(birthDate) : null,
                    sex,
                    status: 'ACTIVE',
                    startDate,
                    expiryDate,
                    password: await bcrypt.hash('password123', 10) // Default password
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
                    externalRef: method === 'GCASH' ? (gcashReference || null) : null,
                    externalDate: method === 'GCASH' ? externalDate : null
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

            return { member: hydratedMember || createdMember, payment: createdPayment };
        });

        res.json({ member, payment });
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
        if (!['CASH', 'CARD', 'GCASH'].includes(normalizedMethod)) {
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
        if (normalizedMethod === 'GCASH' && !gcashReference) {
            return res.status(400).json({ error: "GCash reference is required for GCash renewals" });
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

        const updatedMember = await prisma.member.update({
            where: { id: Number(id) },
            data: {
                expiryDate: newExpiry,
                status: 'ACTIVE',
                ...(planId ? { planId: Number(planId) } : {}),
                ...(getPlanClassSessions(selectedPlan) > 0
                    ? { classSessionsRemaining: { increment: getPlanClassSessions(selectedPlan) } }
                    : {})
            }
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
                externalRef: normalizedMethod === 'GCASH' ? (gcashReference || null) : null,
                externalDate: normalizedMethod === 'GCASH' ? externalDate : null
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

    const normalizedMethod = String(method || '').toUpperCase();
    if (!['CASH', 'CARD', 'GCASH'].includes(normalizedMethod)) {
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
        if (normalizedMethod === 'GCASH' && !gcashReference) {
            return res.status(400).json({ error: "GCash reference is required for GCash payments" });
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
                    externalRef: normalizedMethod === 'GCASH' ? (gcashReference || null) : null,
                    externalDate: normalizedMethod === 'GCASH' ? externalDate : null
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
