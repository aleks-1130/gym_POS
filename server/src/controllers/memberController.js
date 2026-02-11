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

// Only Staff/Admin can list all members
const getMembers = async (req, res) => {
    try {
        const members = await prisma.member.findMany({
            include: { plan: true }
        });
        res.json(members);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Get Available Classes (Member View)
const getAvailableClasses = async (req, res) => {
    try {
        const classes = await prisma.class.findMany({
            include: {
                trainer: true,
                bookings: {
                    where: { memberId: req.user.id }
                }
            }
        });
        // Transform to indicate if booked
        const result = classes.map(c => ({
            ...c,
            isBooked: c.bookings.length > 0
        }));
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Book a Class
const bookClass = async (req, res) => {
    const { classId } = req.body;
    const memberId = req.user.id;

    // Safety check: Ensure user is a member
    if (req.user.type !== 'MEMBER') return res.status(403).json({ error: "Only members can book classes" });

    try {
        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(404).json({ error: "Class not found" });

        if (cls.enrolled >= cls.capacity) return res.status(400).json({ error: "Class is full" });

        // Check if already booked
        const existing = await prisma.booking.findFirst({
            where: { memberId, classId, status: 'CONFIRMED' }
        });
        if (existing) return res.status(400).json({ error: "Already booked" });

        // Transaction: Create Booking + Increment Enrollment
        await prisma.$transaction([
            prisma.booking.create({
                data: { memberId, classId, status: 'CONFIRMED' }
            }),
            prisma.class.update({
                where: { id: classId },
                data: { enrolled: { increment: 1 } }
            })
        ]);

        res.json({ message: "Booking confirmed" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Cancel Booking
const cancelBooking = async (req, res) => {
    const { classId } = req.body;
    const memberId = req.user.id;

    try {
        const booking = await prisma.booking.findFirst({
            where: { memberId, classId, status: 'CONFIRMED' }
        });

        if (!booking) return res.status(404).json({ error: "Booking not found" });

        await prisma.$transaction([
            prisma.booking.delete({ where: { id: booking.id } }),
            prisma.class.update({
                where: { id: classId },
                data: { enrolled: { decrement: 1 } }
            })
        ]);

        res.json({ message: "Booking cancelled" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Book a Trainer Session (Member)
const bookTraining = async (req, res) => {
    const { trainerId, date, time, duration, notes, method } = req.body;
    const memberId = req.user.id;

    if (req.user.type !== 'MEMBER') {
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

    if (req.user.type !== 'MEMBER') {
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
    if (req.user.type !== 'MEMBER') {
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
        // Calculate expiry based on plan
        const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(startDate.getDate() + (plan ? plan.duration : 30));

        const member = await prisma.member.create({
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

        let payment = null;
        if (plan) {
            const pointsAwarded = Math.floor(plan.price / 100);
            const externalDate = (gcashDate && gcashTime) ? new Date(`${gcashDate}T${gcashTime}`) : null;
            payment = await prisma.payment.create({
                data: {
                    amount: plan.price,
                    type: 'MEMBERSHIP',
                    method: paymentMethod || 'CASH',
                    memberId: member.id,
                    cashierId: req.user.id,
                    pointsAwarded,
                    cashTendered: paymentMethod === 'CASH' ? (cashTendered !== undefined ? Number(cashTendered) : null) : null,
                    changeDue: paymentMethod === 'CASH' ? (changeDue !== undefined ? Number(changeDue) : null) : null,
                    externalRef: paymentMethod === 'GCASH' ? (gcashReference || null) : null,
                    externalDate: paymentMethod === 'GCASH' ? externalDate : null
                }
            });

            await prisma.paymentItem.create({
                data: {
                    paymentId: payment.id,
                    productId: null,
                    name: plan.name,
                    type: 'PLAN',
                    quantity: 1,
                    unitPrice: plan.price
                }
            });

            if (pointsAwarded > 0) {
                await prisma.member.update({
                    where: { id: member.id },
                    data: { points: { increment: pointsAwarded } }
                });
            }
        }

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
        const member = await prisma.member.findUnique({ where: { id: Number(id) } });
        if (!member) return res.status(404).json({ error: "Member not found" });

        const now = new Date();
        const currentExpiry = member.expiryDate && new Date(member.expiryDate) > now ? new Date(member.expiryDate) : now;
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + Number(duration));

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
                ...(planId ? { planId: Number(planId) } : {})
            }
        });

        await prisma.membershipPeriod.create({
            data: {
                memberId: Number(id),
                planId: planId ? Number(planId) : member.planId,
                startDate: currentExpiry,
                endDate: newExpiry,
                amount: amount !== undefined && amount !== null ? parseFloat(amount) : null,
                method: method || null
            }
        });

        const externalDate = (gcashDate && gcashTime) ? new Date(`${gcashDate}T${gcashTime}`) : null;
        const pointsAwarded = Math.floor(parseFloat(amount) / 100);

        const payment = await prisma.payment.create({
            data: {
                amount: parseFloat(amount),
                type: 'MEMBERSHIP',
                method,
                memberId: Number(id),
                cashierId: req.user.id,
                pointsAwarded,
                cashTendered: method === 'CASH' ? (cashTendered !== undefined ? Number(cashTendered) : null) : null,
                changeDue: method === 'CASH' ? (changeDue !== undefined ? Number(changeDue) : null) : null,
                externalRef: method === 'GCASH' ? (gcashReference || null) : null,
                externalDate: method === 'GCASH' ? externalDate : null
            }
        });

        let planName = 'Membership Renewal';
        if (planId) {
            const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
            if (plan?.name) planName = plan.name;
        }

        await prisma.paymentItem.create({
            data: {
                paymentId: payment.id,
                productId: null,
                name: planName,
                type: 'PLAN',
                quantity: 1,
                unitPrice: parseFloat(amount)
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
    getMemberPayments,
    getMemberNotes,
    addMemberNote,
    updateMemberStatus,
    updateMember,
    changePassword
};
