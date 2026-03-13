const prisma = require('../../config/prisma');

// GET /api/pos/promo-codes
const getPromoCodes = async (req, res) => {
    try {
        const promos = await prisma.promoCode.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(promos);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch promo codes' });
    }
};

// POST /api/pos/promo-codes
const createPromoCode = async (req, res) => {
    try {
        const { code, type, value, description, maxUses, expiryDate } = req.body;
        
        // Ensure code is unique
        const existing = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
        if (existing) return res.status(400).json({ error: 'Promo code already exists' });

        const promo = await prisma.promoCode.create({
            data: {
                code: code.toUpperCase(),
                type,
                value: Number(value),
                description,
                maxUses: maxUses ? Number(maxUses) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null
            }
        });
        res.status(201).json(promo);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create promo code' });
    }
};

// PUT /api/pos/promo-codes/:id
const updatePromoCode = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, description, maxUses, expiryDate } = req.body;
        
        const promo = await prisma.promoCode.update({
            where: { id: Number(id) },
            data: {
                isActive: isActive !== undefined ? isActive : undefined,
                description: description !== undefined ? description : undefined,
                maxUses: maxUses !== undefined ? (maxUses ? Number(maxUses) : null) : undefined,
                expiryDate: expiryDate !== undefined ? (expiryDate ? new Date(expiryDate) : null) : undefined
            }
        });
        res.json(promo);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update promo code' });
    }
};

// DELETE /api/pos/promo-codes/:id
const deletePromoCode = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.promoCode.update({
            where: { id: Number(id) },
            data: { isActive: false }
        });
        res.json({ message: 'Promo code deactivated' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete promo code' });
    }
};

module.exports = {
    getPromoCodes,
    createPromoCode,
    updatePromoCode,
    deletePromoCode
};
