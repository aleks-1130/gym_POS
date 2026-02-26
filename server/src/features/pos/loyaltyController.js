const prisma = require('../../config/prisma');

const getRewards = async (req, res) => {
    try {
        const rewards = await prisma.loyaltyReward.findMany();
        res.json(rewards);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch rewards" });
    }
};

const createReward = async (req, res) => {
    try {
        const { name, cost, category, description, imageUrl } = req.body;
        const reward = await prisma.loyaltyReward.create({
            data: {
                name,
                cost: parseInt(cost) || 0,
                category: category || 'MERCHANDISE',
                description,
                imageUrl
            }
        });
        res.json(reward);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updateReward = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, cost, category, description, imageUrl } = req.body;
        const reward = await prisma.loyaltyReward.update({
            where: { id: Number(id) },
            data: { name, cost: parseInt(cost) || 0, category, description, imageUrl }
        });
        res.json(reward);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const deleteReward = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.loyaltyReward.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const managePoints = async (req, res) => {
    const { id } = req.params;
    const { points, type } = req.body; // type=ADD or REDEEM
    try {
        const member = await prisma.member.findUnique({ where: { id: Number(id) } });
        if (!member) return res.status(404).json({ error: "Member not found" });

        let newPoints = member.points;
        if (type === 'ADD') newPoints += Number(points);
        if (type === 'REDEEM') {
            if (member.points < Number(points)) return res.status(400).json({ error: "Insufficient points" });
            newPoints -= Number(points);
        }

        const updated = await prisma.member.update({
            where: { id: Number(id) },
            data: { points: newPoints }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update points" });
    }
};

module.exports = {
    getRewards,
    createReward,
    updateReward,
    deleteReward,
    managePoints
};
