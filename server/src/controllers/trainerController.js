const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const {
    withTrainerAvailability,
    setTrainerAvailability,
    removeTrainerAvailability
} = require('../services/trainerAvailabilityService');
const { syncToNeonAuth } = require('../services/neonAuthSync');

const getAllTrainers = async (req, res) => {
    try {
        const trainers = await prisma.trainer.findMany({
            include: {
                classes: true,
                trainingSessions: {
                    where: {
                        date: { gte: new Date() },
                        status: { not: 'CANCELLED' }
                    },
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(trainers.map(withTrainerAvailability));
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainers" });
    }
};

const getTrainerById = async (req, res) => {
    try {
        const trainer = await prisma.trainer.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                classes: true,
                trainingSessions: {
                    select: {
                        id: true,
                        date: true,
                        duration: true,
                        status: true,
                        member: true
                    },
                    take: 10,
                    orderBy: { date: 'desc' }
                }
            }
        });
        res.json(withTrainerAvailability(trainer));
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer profile" });
    }
};

const getMe = async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const trainer = await prisma.trainer.findUnique({
            where: { id: Number(trainerId) },
            include: { classes: true }
        });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });
        res.json(withTrainerAvailability(trainer));
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer profile" });
    }
};

const getMyCommissions = async (req, res) => {
    try {
        const trainerId = Number(req.user?.trainerId);
        if (!trainerId) {
            return res.status(400).json({ error: "Trainer account is not linked" });
        }

        const trainer = await prisma.trainer.findUnique({
            where: { id: trainerId },
            select: { id: true, name: true, commissionRate: true }
        });
        if (!trainer) {
            return res.status(404).json({ error: "Trainer not found" });
        }

        const [completedSessions, classHistory, payoutExpenses] = await Promise.all([
            prisma.trainingSession.findMany({
                where: { trainerId, status: 'COMPLETED' },
                select: {
                    id: true,
                    date: true,
                    duration: true,
                    price: true,
                    commissionPaid: true,
                    member: { select: { id: true, firstName: true, lastName: true } }
                },
                orderBy: { date: 'desc' }
            }),
            prisma.classHistory.findMany({
                where: { trainerId },
                select: {
                    id: true,
                    date: true,
                    attendeeCount: true,
                    commissionAmount: true,
                    commissionPaid: true,
                    class: { select: { id: true, name: true, dayOfWeek: true, time: true } }
                },
                orderBy: { date: 'desc' }
            }),
            prisma.expense.findMany({
                where: {
                    trainerId,
                    category: 'SALARY',
                    title: { startsWith: 'Commission Payout:' }
                },
                select: { id: true, title: true, amount: true, date: true, notes: true },
                orderBy: { date: 'desc' }
            })
        ]);

        const sessionHistory = completedSessions.map((session) => ({
            id: `session-${session.id}`,
            source: 'SESSION',
            referenceId: session.id,
            date: session.date,
            label: `1-on-1 with ${session.member?.firstName || ''} ${session.member?.lastName || ''}`.trim(),
            grossAmount: Number(session.price || 0),
            commissionAmount: Number(session.price || 0) * Number(trainer.commissionRate || 0),
            commissionPaid: Boolean(session.commissionPaid)
        }));

        const classHistoryItems = classHistory.map((entry) => ({
            id: `class-${entry.id}`,
            source: 'CLASS',
            referenceId: entry.id,
            date: entry.date,
            label: entry.class?.name || 'Class Session',
            attendees: Number(entry.attendeeCount || 0),
            grossAmount: null,
            commissionAmount: Number(entry.commissionAmount || 0),
            commissionPaid: Boolean(entry.commissionPaid)
        }));

        const allCommissionHistory = [...sessionHistory, ...classHistoryItems]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const sessionsEarned = sessionHistory.reduce((sum, item) => sum + item.commissionAmount, 0);
        const classesEarned = classHistoryItems.reduce((sum, item) => sum + item.commissionAmount, 0);
        const totalEarned = sessionsEarned + classesEarned;
        const totalPaidMarked = allCommissionHistory
            .filter((item) => item.commissionPaid)
            .reduce((sum, item) => sum + item.commissionAmount, 0);
        const totalPayoutRecorded = payoutExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const totalUnpaid = allCommissionHistory
            .filter((item) => !item.commissionPaid)
            .reduce((sum, item) => sum + item.commissionAmount, 0);

        return res.json({
            trainer: {
                id: trainer.id,
                name: trainer.name,
                commissionRate: Number(trainer.commissionRate || 0)
            },
            summary: {
                totalEarned,
                sessionsEarned,
                classesEarned,
                totalPaidMarked,
                totalPayoutRecorded,
                totalUnpaid,
                completedSessions: sessionHistory.length,
                completedClasses: classHistoryItems.length
            },
            history: {
                commissions: allCommissionHistory,
                payouts: payoutExpenses
            }
        });
    } catch (e) {
        console.error("Failed to fetch trainer commissions:", e);
        return res.status(500).json({ error: "Failed to fetch trainer commissions" });
    }
};

const createTrainer = async (req, res) => {
    try {
        const {
            name,
            type,
            specialty,
            specialization,
            email,
            phone,
            bio,
            imageUrl,
            experience,
            rating,
            sessionPrice,
            sessionDurations,
            availableSlots,
            specialties,
            commissionRate,
            baseSalary,
            createLogin,
            loginEmail,
            loginPassword
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Trainer name is required' });
        }

        // Validate trainer type and commission rate
        const trainerType = type || 'FULLTIME';
        const rate = commissionRate !== '' && commissionRate !== undefined ? Number(commissionRate) : 0;
        if (trainerType === 'FREELANCER') {
            if (baseSalary && Number(baseSalary) > 0) {
                return res.status(400).json({ error: 'Freelancers cannot have base salary' });
            }
            if (rate < 0.4 || rate > 1.0) {
                return res.status(400).json({ error: 'Freelancer commission should be 40-100%' });
            }
        }
        if (trainerType === 'FULLTIME' && rate > 0.4) {
            return res.status(400).json({ error: 'Full-time commission cannot exceed 40%' });
        }

        // 1. Check if login email is taken (if creating login)
        if (createLogin && loginEmail) {
            const existingUser = await prisma.user.findUnique({ where: { email: String(loginEmail).trim() } });
            if (existingUser) {
                return res.status(400).json({ error: 'Login email is already taken' });
            }
        }

        const trainer = await prisma.trainer.create({
            data: {
                name: String(name).trim(),
                type: trainerType,
                specialty: specialty ? String(specialty).trim() : 'Personal Trainer',
                specialization: specialization ? String(specialization).trim() : null,
                email: email ? String(email).trim() : null,
                phone: phone ? String(phone).trim() : null,
                bio: bio ? String(bio).trim() : null,
                imageUrl: imageUrl ? String(imageUrl).trim() : null,
                experience: experience !== '' && experience !== undefined ? Number(experience) : null,
                rating: rating !== '' && rating !== undefined ? Number(rating) : undefined,
                sessionPrice: sessionPrice !== '' && sessionPrice !== undefined ? Number(sessionPrice) : undefined,
                sessionDurations: sessionDurations ? String(sessionDurations) : '60',
                availableSlots: availableSlots !== '' && availableSlots !== undefined ? Number(availableSlots) : null,
                specialties: specialties ? String(specialties) : null,
                commissionRate: commissionRate !== '' && commissionRate !== undefined ? Number(commissionRate) : 0.0,
                baseSalary: baseSalary !== '' && baseSalary !== undefined ? Number(baseSalary) : 0.0
            }
        });

        // 2. Create Login if requested
        if (createLogin && loginEmail && loginPassword) {
            try {
                const hashed = await bcrypt.hash(String(loginPassword), 10);
                await prisma.user.create({
                    data: {
                        email: String(loginEmail).trim(),
                        password: hashed,
                        name: trainer.name,
                        role: 'TRAINER',
                        trainerId: trainer.id
                    }
                });
            } catch (e) {
                console.error("Failed to create trainer login:", e);
                // Don't fail the whole request, but maybe warn?
            }
        }

        // 3. Sync to Neon Auth (Dual Write)
        if (createLogin && loginEmail && loginPassword) {
            // Fire and forget, or await? Awaiting is safer to see logs.
            await syncToNeonAuth(name, loginEmail, loginPassword);
        }

        const availability = setTrainerAvailability(trainer.id, req.body);
        res.json({ ...trainer, ...availability });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create trainer' });
    }
};

const updateTrainer = async (req, res) => {
    const trainerId = Number(req.params.id);
    try {
        const {
            name,
            type,
            specialty,
            specialization,
            email,
            phone,
            bio,
            imageUrl,
            experience,
            rating,
            sessionPrice,
            sessionDurations,
            availableSlots,
            specialties,
            commissionRate,
            baseSalary
        } = req.body;

        // Validate trainer type and commission rate
        if (type !== undefined) {
            const rate = commissionRate !== undefined && commissionRate !== '' ? Number(commissionRate) : null;
            if (type === 'FREELANCER') {
                if (baseSalary !== undefined && Number(baseSalary) > 0) {
                    return res.status(400).json({ error: 'Freelancers cannot have base salary' });
                }
                if (rate !== null && (rate < 0.4 || rate > 1.0)) {
                    return res.status(400).json({ error: 'Freelancer commission should be 40-100%' });
                }
            }
            if (type === 'FULLTIME' && rate !== null && rate > 0.4) {
                return res.status(400).json({ error: 'Full-time commission cannot exceed 40%' });
            }
        }

        const trainer = await prisma.trainer.update({
            where: { id: trainerId },
            data: {
                ...(name !== undefined ? { name: String(name).trim() } : {}),
                ...(type !== undefined ? { type } : {}),
                ...(specialty !== undefined ? { specialty: String(specialty || 'Personal Trainer').trim() } : {}),
                ...(specialization !== undefined ? { specialization: specialization ? String(specialization).trim() : null } : {}),
                ...(email !== undefined ? { email: email ? String(email).trim() : null } : {}),
                ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
                ...(bio !== undefined ? { bio: bio ? String(bio).trim() : null } : {}),
                ...(imageUrl !== undefined ? { imageUrl: imageUrl ? String(imageUrl).trim() : null } : {}),
                ...(experience !== undefined ? { experience: experience === '' ? null : Number(experience) } : {}),
                ...(rating !== undefined ? { rating: rating === '' ? null : Number(rating) } : {}),
                ...(sessionPrice !== undefined && sessionPrice !== '' ? { sessionPrice: Number(sessionPrice) } : {}),
                ...(sessionDurations !== undefined ? { sessionDurations: String(sessionDurations) } : {}),
                ...(availableSlots !== undefined ? { availableSlots: availableSlots === '' ? null : Number(availableSlots) } : {}),
                ...(specialties !== undefined ? { specialties: specialties ? String(specialties) : null } : {}),
                ...(commissionRate !== undefined && commissionRate !== '' ? { commissionRate: Number(commissionRate) } : {}),
                ...(baseSalary !== undefined && baseSalary !== '' ? { baseSalary: Number(baseSalary) } : {})
            }
        });

        const availability = setTrainerAvailability(trainer.id, req.body);
        res.json({ ...trainer, ...availability });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to update trainer' });
    }
};

const deleteTrainer = async (req, res) => {
    const trainerId = Number(req.params.id);
    try {
        await prisma.trainer.delete({ where: { id: trainerId } });
        removeTrainerAvailability(trainerId);
        res.json({ message: 'Trainer deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to delete trainer' });
    }
};

const createTrainerLogin = async (req, res) => {
    const trainerId = Number(req.params.id);
    const { loginEmail, loginPassword } = req.body;
    if (!loginEmail || !loginPassword) {
        return res.status(400).json({ error: 'Login email and password are required' });
    }
    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
        if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: String(loginEmail).trim() }, { trainerId }]
            }
        });
        if (existingUser) return res.status(400).json({ error: 'Trainer login already exists or email is taken' });

        const hashed = await bcrypt.hash(String(loginPassword), 10);
        const user = await prisma.user.create({
            data: {
                email: String(loginEmail).trim(),
                password: hashed,
                name: trainer.name,
                role: 'TRAINER',
                trainerId
            },
            select: { id: true, email: true, role: true, trainerId: true }
        });

        // Sync to Neon Auth
        await syncToNeonAuth(trainer.name, String(loginEmail).trim(), String(loginPassword));

        res.json({ message: 'Trainer login created', user });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create trainer login' });
    }
};

module.exports = {
    getAllTrainers,
    getTrainerById,
    getMe,
    getMyCommissions,
    createTrainer,
    updateTrainer,
    deleteTrainer,
    createTrainerLogin
};
