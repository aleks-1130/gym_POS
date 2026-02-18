const prisma = require('../config/prisma');

const getAllClasses = async (req, res) => {
    const where = req.user.role === 'TRAINER' ? { trainerId: Number(req.user.trainerId) } : {};
    try {
        const classes = await prisma.class.findMany({
            where,
            include: {
                trainer: true,
                bookings: {
                    include: { member: true }
                }
            },
            orderBy: { dayOfWeek: 'asc' }
        });
        res.json(classes);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch classes" });
    }
};

const getClassParticipants = async (req, res) => {
    try {
        if (req.user.role === 'TRAINER') {
            const cls = await prisma.class.findUnique({ where: { id: Number(req.params.id) } });
            if (!cls || cls.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        const participants = await prisma.booking.findMany({
            where: { classId: Number(req.params.id) },
            include: { member: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(participants);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch participants" });
    }
};

const createClass = async (req, res) => {
    const { name, trainerId, dayOfWeek, time, duration, capacity } = req.body;
    const resolvedTrainerId = req.user.role === 'TRAINER' ? Number(req.user.trainerId) : Number(trainerId);
    if (!resolvedTrainerId) return res.status(400).json({ error: "Trainer is required" });
    try {
        const gymClass = await prisma.class.create({
            data: {
                name, dayOfWeek, time,
                duration: Number(duration),
                capacity: Number(capacity),
                trainerId: resolvedTrainerId
            }
        });
        res.json(gymClass);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updateClass = async (req, res) => {
    const classId = Number(req.params.id);
    const { name, trainerId, dayOfWeek, time, duration, capacity } = req.body;
    try {
        if (req.user.role === 'TRAINER') {
            const existing = await prisma.class.findUnique({ where: { id: classId } });
            if (!existing || existing.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        const resolvedTrainerId = req.user.role === 'TRAINER'
            ? Number(req.user.trainerId)
            : (trainerId !== undefined && trainerId !== '' ? Number(trainerId) : undefined);

        const gymClass = await prisma.class.update({
            where: { id: classId },
            data: {
                name,
                dayOfWeek,
                time,
                duration: duration !== undefined && duration !== '' ? Number(duration) : undefined,
                capacity: capacity !== undefined && capacity !== '' ? Number(capacity) : undefined,
                trainerId: resolvedTrainerId
            }
        });
        res.json(gymClass);
    } catch (e) {
        res.status(500).json({ error: "Failed to update class", detail: e?.message });
    }
};

const deleteClass = async (req, res) => {
    const classId = Number(req.params.id);
    try {
        if (req.user.role === 'TRAINER') {
            const existing = await prisma.class.findUnique({ where: { id: classId } });
            if (!existing || existing.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        await prisma.$transaction(async (tx) => {
            await tx.booking.deleteMany({ where: { classId } });
            await tx.class.delete({ where: { id: classId } });
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete class", detail: e?.message });
    }
};

const updateAttendeeStatus = async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const classId = Number(req.params.classId);
        const bookingId = Number(req.params.bookingId);
        const { status } = req.body;
        const allowed = ['CONFIRMED', 'ATTENDED', 'CANCELLED'];
        if (!allowed.includes(String(status).toUpperCase())) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls || cls.trainerId !== Number(trainerId)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.classId !== classId) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const updated = await prisma.booking.update({
            where: { id: bookingId },
            data: { status: String(status).toUpperCase() }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update attendee status", detail: e?.message });
    }
};

const completeClass = async (req, res) => {
    const classId = Number(req.params.id);
    const trainerId = req.user.trainerId;

    if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });

    try {
        const cls = await prisma.class.findUnique({
            where: { id: classId },
            include: { trainer: true }
        });

        if (!cls) return res.status(404).json({ error: "Class not found" });

        // Allow substitutions? For now, let's assume the logged-in trainer is the one completing it.
        // If we want to restrict to assigned trainer:
        // if (cls.trainerId !== Number(trainerId)) return res.status(403).json({ error: "Access denied" });

        // 1. Calculate Attendance from Active Bookings
        // In a real scenario, we might want a separate "Attendance" input, but for MVP, verify active bookings.
        const attendees = await prisma.booking.count({
            where: {
                classId: classId,
                status: { in: ['CONFIRMED', 'ATTENDED'] } // Count confirmed or attended
            }
        });

        // 2. Calculate Commission (Per Booking Logic)
        // Formula: Attendees * (Trainer Commission Rate * Class Price? OR Flat Rate?)
        // Since Class doesn't have a price field in schema yet (it's on Plan), let's assume a generic calculation or use Trainer's base rate?
        // User asked for "Per Booking". Let's assume Trainer's commission rate applies to a "base value" or fixed amount per head.
        // LIMITATION: 'Class' model has no price. 
        // TEMPORARY FIX: Use a default value (e.g., $10 per head) or Trainer's 'sessionPrice'? 
        // Let's use Trainer's 'commissionRate' * 'sessionPrice' (as a proxy for class value per head) OR just flat rate.
        // CORRECT LOGIC BASED ON REQUEST: "Commission per member booking"
        // Let's assume $10 value per student for now, or fetch from a config. 
        // Better: Trainer has `sessionPrice`. Let's treat that as "Price per Class" or "Price per Session".
        // Actually, usually classes have a set rate per student.
        // Let's use: Commission = Attendees * (Trainer's Commission Rate * 100). (e.g. 5 students * (50% * 100) = $250?? No.)

        // REVISED LOGIC: 
        // Let's assume the Trainer gets a flat amount per student.
        // OR: Total Class Value = Attendees * $10. Commission = Total * TrainerRate.
        // Let's hardcode a "Class Value Per Student" of $15 for now (Average Gym Class).
        const VALUE_PER_STUDENT = 15.0;
        const totalValue = attendees * VALUE_PER_STUDENT;
        const commissionAmount = totalValue * (cls.trainer.commissionRate || 0);

        // 3. Create History Record
        const history = await prisma.classHistory.create({
            data: {
                classId,
                trainerId: Number(trainerId),
                date: new Date(),
                attendeeCount: attendees,
                commissionAmount: commissionAmount,
                commissionPaid: false
            }
        });

        // 4. Optionally mark bookings as "ATTENDED"?
        // await prisma.booking.updateMany({ ... });

        res.json(history);

    } catch (e) {
        console.error("Complete Class Error:", e);
        res.status(500).json({ error: "Failed to complete class" });
    }
};

module.exports = {
    getAllClasses,
    getClassParticipants,
    createClass,
    updateClass,
    deleteClass,
    updateAttendeeStatus,
    completeClass
};
