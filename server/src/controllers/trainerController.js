const prisma = require('../config/prisma');

const getAllTrainers = async (req, res) => {
    try {
        const trainers = await prisma.trainer.findMany({
            include: { classes: true },
            orderBy: { name: 'asc' }
        });
        res.json(trainers);
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
        res.json(trainer);
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
        res.json(trainer);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer profile" });
    }
};

module.exports = {
    getAllTrainers,
    getTrainerById,
    getMe
};
