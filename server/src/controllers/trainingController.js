const prisma = require('../config/prisma');

// Staff/Admin book a trainer session for a member
const bookTraining = async (req, res) => {
    const { memberId, trainerId, date, time, duration, notes, method } = req.body;
    if (!memberId || !trainerId || !date || !time || !duration || !method) {
        return res.status(400).json({ error: "Missing required booking details" });
    }
    const allowedMethods = ['CASH', 'CARD', 'GCASH'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        if (trainer.availableSlots !== null && trainer.availableSlots <= 0) {
            return res.status(400).json({ error: "Trainer is fully booked" });
        }

        const startDateTime = new Date(`${date}T${time}`);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date or time" });
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

            await tx.payment.create({
                data: {
                    amount: totalAmount,
                    type: 'TRAINING',
                    method,
                    status: 'COMPLETED',
                    memberId: Number(memberId),
                    cashierId: req.user.id
                }
            });

            if (trainer.availableSlots !== null) {
                await tx.trainer.update({
                    where: { id: Number(trainerId) },
                    data: { availableSlots: { decrement: 1 } }
                });
            }
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
        const where = status ? { paymentStatus: String(status).toUpperCase() } : {};
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
    const allowedMethods = ['CASH', 'CARD', 'GCASH'];
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

            const payment = await tx.payment.create({
                data: {
                    amount,
                    type: 'TRAINING',
                    method,
                    status: 'COMPLETED',
                    memberId: session.memberId,
                    cashierId: req.user.id,
                    cashTendered: method === 'CASH' ? tendered : null,
                    changeDue: method === 'CASH' ? changeDue : null
                }
            });

            return { updated, payment };
        });

        res.json(payment);
    } catch (e) {
        res.status(500).json({ error: "Failed to collect payment", detail: e?.message });
    }
};

module.exports = {
    bookTraining,
    getTrainingSessions,
    collectSessionPayment
};
