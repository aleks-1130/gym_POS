const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const {
    withTrainerAvailability,
    setTrainerAvailability,
    removeTrainerAvailability,
    getTrainerAvailability,
    getTrainerAvailabilityMap,
    normalizeAvailability,
    isTimeAllowedForAvailability
} = require('../../services/trainerAvailabilityService');
const { syncToNeonAuth } = require('../../services/neonAuthSync');
const crypto = require('crypto');
const { sendActivationEmail } = require('../../services/emailService');

const FINALIZED_SESSION_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'DECLINED'];

const toLocalIsoDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const toLocalTime = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const hasUpcomingSessionOnIsoDate = ({ sessions, isoDate, now = new Date() }) => {
    return (sessions || []).some((session) => {
        const sessionDate = new Date(session.date);
        if (Number.isNaN(sessionDate.getTime())) return false;
        if (sessionDate < now) return false;
        if (FINALIZED_SESSION_STATUSES.includes(String(session.status || '').toUpperCase())) return false;
        return toLocalIsoDate(sessionDate) === isoDate;
    });
};

const findAvailabilityConflicts = (sessions, nextAvailability) => {
    return (sessions || [])
        .filter((session) => {
            const date = toLocalIsoDate(session.date);
            const time = toLocalTime(session.date);
            const duration = Number(session.duration) || 0;
            if (!date || !time || duration <= 0) return false;
            return !isTimeAllowedForAvailability({
                availability: nextAvailability,
                date,
                time,
                duration,
                enforceBookingStatus: false
            });
        })
        .map((session) => ({
            id: session.id,
            date: session.date,
            duration: Number(session.duration) || 0,
            status: session.status,
            memberName: session.member ? `${session.member.firstName || ''} ${session.member.lastName || ''}`.trim() : 'Member'
        }));
};

const getAllTrainers = async (req, res) => {
    try {
        const now = new Date();
        const todayIso = toLocalIsoDate(now);
        const trainers = await prisma.trainer.findMany({
            include: {
                classes: true,
                trainingSessions: {
                    where: {
                        date: { gte: now },
                        status: { not: 'CANCELLED' }
                    },
                }
            },
            orderBy: { name: 'asc' }
        });
        const availabilityMap = await getTrainerAvailabilityMap(trainers.map((trainer) => trainer.id));
        const hydrated = trainers.map((trainer) => {
            const normalized = {
                ...trainer,
                ...(availabilityMap.get(trainer.id) || {
                    availabilityDays: [],
                    availabilityStart: '',
                    availabilityEnd: '',
                    availabilityIntervalMinutes: 30,
                    specificDateAvailability: {},
                    bookingStatus: 'OPEN'
                })
            };
            const bookingStatus = String(normalized.bookingStatus || 'OPEN').toUpperCase();
            return {
                ...normalized,
                temporarilyOpenToday: bookingStatus === 'CLOSED'
                    ? hasUpcomingSessionOnIsoDate({
                        sessions: trainer.trainingSessions,
                        isoDate: todayIso,
                        now
                    })
                    : false
            };
        });
        if (req.user?.role === 'MEMBER') {
            return res.json(
                hydrated.filter((trainer) => {
                    const bookingStatus = String(trainer.bookingStatus || 'OPEN').toUpperCase();
                    return bookingStatus === 'OPEN' || Boolean(trainer.temporarilyOpenToday);
                })
            );
        }
        res.json(hydrated);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainers", detail: e?.message });
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
        res.json(await withTrainerAvailability(trainer));
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer profile" });
    }
};

const getMe = async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const numericTrainerId = Number(trainerId);
        const [trainer, checkIns] = await Promise.all([
            prisma.trainer.findUnique({
                where: { id: numericTrainerId },
                include: {
                    classes: true,
                    user: {
                        select: {
                            id: true,
                            loyaltyPoints: true
                        }
                    }
                }
            }),
            prisma.accessLog.count({
                where: {
                    trainerId: numericTrainerId,
                    status: { not: 'DENIED' }
                }
            })
        ]);
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });
        const trainerWithAvailability = await withTrainerAvailability(trainer);
        res.json({
            ...trainerWithAvailability,
            loyaltyPoints: Number(trainer.user?.loyaltyPoints || 0),
            checkIns: Number(checkIns || 0)
        });
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

        const [completedSessions, classHistory, payoutExpenses, materialItems] = await Promise.all([
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
            }),
            prisma.paymentItem.findMany({
                where: {
                    intendedForSessionMaterial: true,
                    payment: {
                        cashierId: Number(req.user.id),
                        method: 'COMMISSION_DEDUCTION'
                    }
                },
                select: {
                    id: true,
                    quantity: true,
                    returnedQuantity: true,
                    unitPrice: true,
                    materialUsedQuantity: true,
                    materialSettledQuantity: true
                }
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
        const materialUsedAmount = materialItems.reduce((sum, item) => {
            return sum + (Number(item.unitPrice || 0) * Number(item.materialUsedQuantity || 0));
        }, 0);
        const materialDeductedAmount = materialItems.reduce((sum, item) => {
            return sum + (Number(item.unitPrice || 0) * Number(item.materialSettledQuantity || 0));
        }, 0);
        const materialPendingDeduction = materialItems.reduce((sum, item) => {
            const unsettledQty = Math.max(
                0,
                Number(item.quantity || 0) - Number(item.returnedQuantity || 0) - Number(item.materialSettledQuantity || 0)
            );
            return sum + (Number(item.unitPrice || 0) * unsettledQty);
        }, 0);

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
                materialUsedAmount,
                materialDeductedAmount,
                materialPendingDeduction,
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

const updateMyAvailability = async (req, res) => {
    try {
        const trainerId = Number(req.user?.trainerId);
        if (!trainerId) {
            return res.status(400).json({ error: "Trainer account is not linked" });
        }

        const trainer = await prisma.trainer.findUnique({
            where: { id: trainerId },
            select: { id: true, name: true }
        });
        if (!trainer) {
            return res.status(404).json({ error: "Trainer not found" });
        }

        const currentAvailability = await getTrainerAvailability(trainerId);
        const nextAvailability = normalizeAvailability(req.body || {}, { previous: currentAvailability });
        const now = new Date();
        const upcomingSessions = await prisma.trainingSession.findMany({
            where: {
                trainerId,
                date: { gte: now },
                status: { notIn: FINALIZED_SESSION_STATUSES }
            },
            select: {
                id: true,
                date: true,
                duration: true,
                status: true,
                member: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { date: 'asc' }
        });

        const conflicts = findAvailabilityConflicts(upcomingSessions, nextAvailability);
        if (conflicts.length > 0) {
            return res.status(409).json({
                error: "Cannot save availability because some existing bookings would become unavailable.",
                conflicts
            });
        }

        const availability = await setTrainerAvailability(trainerId, nextAvailability);
        return res.json({ ...trainer, ...availability });
    } catch (e) {
        return res.status(500).json({ error: e.message || "Failed to update trainer availability" });
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
            createLogin
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
        if (createLogin && email) {
            const existingUser = await prisma.user.findUnique({ where: { email: String(email).trim() } });
            if (existingUser) {
                return res.status(400).json({ error: 'Trainer email is already mapped to a login' });
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
        if (createLogin && email) {
            try {
                // Securely generate random temporary password and activation token
                const tempPassword = crypto.randomBytes(16).toString('hex');
                const hashed = await bcrypt.hash(tempPassword, 10);
                const activationToken = crypto.randomBytes(16).toString('hex');
                const activationExpires = new Date();
                activationExpires.setHours(activationExpires.getHours() + 24);

                await prisma.user.create({
                    data: {
                        email: String(email).trim(),
                        password: hashed,
                        name: trainer.name,
                        role: 'TRAINER',
                        trainerId: trainer.id,
                        status: 'PENDING_ACTIVATION',
                        activationToken,
                        activationExpires
                    }
                });

                await sendActivationEmail(
                    String(email).trim(),
                    trainer.name,
                    activationToken,
                    'Staff Access',
                    'Lifetime',
                    phone ? String(phone).trim() : null,
                    null,
                    null,
                    'TRAINER'
                );
            } catch (e) {
                console.error("Failed to create trainer login:", e);
                // Don't fail the whole request, but maybe warn?
            }
        }

        const availability = await setTrainerAvailability(trainer.id, req.body);
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

        const availability = await setTrainerAvailability(trainer.id, req.body);
        res.json({ ...trainer, ...availability });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to update trainer' });
    }
};

const deleteTrainer = async (req, res) => {
    const trainerId = Number(req.params.id);
    try {
        await prisma.trainer.delete({ where: { id: trainerId } });
        await removeTrainerAvailability(trainerId);
        res.json({ message: 'Trainer deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to delete trainer' });
    }
};

const createTrainerLogin = async (req, res) => {
    const trainerId = Number(req.params.id);
    const { loginEmail } = req.body;

    // UI might send loginEmail out of compat, but it's just the main email
    const targetEmail = loginEmail;

    if (!targetEmail) {
        return res.status(400).json({ error: 'Trainer email is required to create a login' });
    }
    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
        if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: String(targetEmail).trim() }, { trainerId }]
            }
        });
        if (existingUser) return res.status(400).json({ error: 'Trainer login already exists or email is taken' });

        const tempPassword = crypto.randomBytes(16).toString('hex');
        const hashed = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(16).toString('hex');
        const activationExpires = new Date();
        activationExpires.setHours(activationExpires.getHours() + 24);

        const user = await prisma.user.create({
            data: {
                email: String(targetEmail).trim(),
                password: hashed,
                name: trainer.name,
                role: 'TRAINER',
                trainerId,
                status: 'PENDING_ACTIVATION',
                activationToken,
                activationExpires
            },
            select: { id: true, email: true, role: true, trainerId: true }
        });

        await sendActivationEmail(
            String(targetEmail).trim(),
            trainer.name,
            activationToken,
            'Staff Access',
            'Lifetime',
            trainer.phone,
            null,
            null,
            'TRAINER'
        );

        res.json({ message: 'Trainer login created and activation email sent', user });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create trainer login' });
    }
};

module.exports = {
    getAllTrainers,
    getTrainerById,
    getMe,
    getMyCommissions,
    updateMyAvailability,
    createTrainer,
    updateTrainer,
    deleteTrainer,
    createTrainerLogin
};
