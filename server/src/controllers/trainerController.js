const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const {
    withTrainerAvailability,
    setTrainerAvailability,
    removeTrainerAvailability
} = require('../services/trainerAvailabilityService');

const getAllTrainers = async (req, res) => {
    try {
        const trainers = await prisma.trainer.findMany({
            include: { classes: true },
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

const createTrainer = async (req, res) => {
    try {
        const {
            name,
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
            specialties
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Trainer name is required' });
        }

        const trainer = await prisma.trainer.create({
            data: {
                name: String(name).trim(),
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
                specialties: specialties ? String(specialties) : null
            }
        });

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
            specialties
        } = req.body;

        const trainer = await prisma.trainer.update({
            where: { id: trainerId },
            data: {
                ...(name !== undefined ? { name: String(name).trim() } : {}),
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
                ...(specialties !== undefined ? { specialties: specialties ? String(specialties) : null } : {})
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

        res.json({ message: 'Trainer login created', user });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create trainer login' });
    }
};

module.exports = {
    getAllTrainers,
    getTrainerById,
    getMe,
    createTrainer,
    updateTrainer,
    deleteTrainer,
    createTrainerLogin
};
