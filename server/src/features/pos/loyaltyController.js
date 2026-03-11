const prisma = require('../../config/prisma');
const crypto = require('crypto');

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
        const { name, cost, category, description, imageUrl, actionType, actionValue } = req.body;
        const reward = await prisma.loyaltyReward.create({
            data: {
                name,
                cost: parseInt(cost) || 0,
                category: category || 'MERCHANDISE',
                description,
                imageUrl,
                actionType: actionType || 'NONE',
                actionValue: actionValue ? parseFloat(actionValue) : null
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
        const { name, cost, category, description, imageUrl, actionType, actionValue } = req.body;
        const reward = await prisma.loyaltyReward.update({
            where: { id: Number(id) },
            data: { 
                name, 
                cost: parseInt(cost) || 0, 
                category, 
                description, 
                imageUrl,
                actionType: actionType || 'NONE',
                actionValue: actionValue ? parseFloat(actionValue) : null
            }
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
    const { points, type, description, rewardId } = req.body; // type=ADD or REDEEM
    try {
        const member = await prisma.member.findUnique({ where: { id: Number(id) } });
        if (!member) return res.status(404).json({ error: "Member not found" });

        const pointAmount = Number(points);
        if (isNaN(pointAmount) || pointAmount <= 0) {
            return res.status(400).json({ error: "Invalid points amount" });
        }

        let reward = null;
        if (type === 'REDEEM' && rewardId) {
            reward = await prisma.loyaltyReward.findUnique({ where: { id: Number(rewardId) } });
        }

        const txResult = await prisma.$transaction(async (tx) => {
            let newPoints = member.points;
            let finalDescription = description;
            let transactionType = type === 'ADD' ? 'EARNED' : 'REDEEMED';

            if (type === 'ADD') {
                newPoints += pointAmount;
                finalDescription = finalDescription || 'Points manually adjusted by staff';
            } else if (type === 'REDEEM') {
                if (member.points < pointAmount) throw new Error('Insufficient points');
                newPoints -= pointAmount;

                if (reward) {
                    finalDescription = `Redeemed reward: ${reward.name}`;
                    
                    // Handle programmatic actions
                    if (reward.actionType === 'FREE_CLASS') {
                        const sessionsToAdd = reward.actionValue || 1;
                        await tx.member.update({
                            where: { id: Number(id) },
                            data: { classSessionsRemaining: { increment: sessionsToAdd } }
                        });
                    } else if (reward.actionType === 'FREE_SESSION') {
                        // Free 1-on-1 personal training session coupon
                        await tx.coupon.create({
                            data: {
                                code: `PT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                                memberId: Number(id),
                                type: 'FREE_SESSION',
                                value: reward.actionValue || 1,
                                status: 'ACTIVE'
                            }
                        });
                    } else if (reward.actionType === 'DISCOUNT') {
                        // Value < 1 = percentage (e.g. 0.2 = 20%), value >= 1 = flat peso (e.g. 100 = ₱100)
                        const discountType = reward.actionValue < 1 ? 'PERCENTAGE' : 'FLAT';
                        await tx.coupon.create({
                            data: {
                                code: `RW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                                memberId: Number(id),
                                type: discountType,
                                value: reward.actionValue,
                                status: 'ACTIVE'
                            }
                        });
                    }
                } else {
                    finalDescription = finalDescription || 'Points manually deducted by staff';
                    transactionType = 'ADJUSTED';
                }
            } else {
                throw new Error('Invalid type');
            }

            // Update Member Points
            const updatedMember = await tx.member.update({
                where: { id: Number(id) },
                data: { points: newPoints }
            });

            // Create Transaction Record
            await tx.loyaltyTransaction.create({
                data: {
                    memberId: Number(id),
                    points: type === 'REDEEM' ? -pointAmount : pointAmount,
                    type: transactionType,
                    description: finalDescription
                }
            });

            return updatedMember;
        });

        res.json(txResult);
    } catch (e) {
        if (e.message === 'Insufficient points') {
            return res.status(400).json({ error: "Insufficient points" });
        }
        res.status(500).json({ error: "Failed to update points: " + e.message });
    }
};

const getHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const history = await prisma.loyaltyTransaction.findMany({
            where: { memberId: Number(id) },
            orderBy: { createdAt: 'desc' }
        });
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch loyalty history" });
    }
};

// GET /api/loyalty/coupons/:memberId — fetch active coupons for a member
const getMemberCoupons = async (req, res) => {
    try {
        const { memberId } = req.params;
        const coupons = await prisma.coupon.findMany({
            where: { memberId: Number(memberId), status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' }
        });
        res.json(coupons);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch coupons" });
    }
};

// POST /api/loyalty/coupons/validate — validate a coupon code and return its discount effect
const validateCoupon = async (req, res) => {
    try {
        const { code, subtotal, memberId } = req.body;
        if (!code) return res.status(400).json({ error: 'Coupon code is required' });

        let coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
        let source = 'LOYALTY';

        if (!coupon) {
            // Fallback to global PromoCode
            coupon = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
            if (!coupon) return res.status(404).json({ error: 'Coupon / Promo code not found' });
            
            if (!coupon.isActive) return res.status(400).json({ error: 'Promo code is inactive' });
            if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
                return res.status(400).json({ error: 'Promo code usage limit reached' });
            }
            source = 'PROMO';
        }

        if (coupon.status && coupon.status !== 'ACTIVE') return res.status(400).json({ error: 'Coupon is already used or expired' });
        
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
            return res.status(400).json({ error: 'Code has expired' });
        }

        // Member-lock: loyalty coupons are tied to the member who redeemed them.
        if (source === 'LOYALTY' && coupon.memberId && memberId && Number(coupon.memberId) !== Number(memberId)) {
            return res.status(403).json({
                error: 'This coupon belongs to a different member. Please select the correct member in the cart.'
            });
        }

        // Compute discount info
        const sub = Number(subtotal) || 0;
        let discountAmount = 0;
        let discountPercent = 0;

        if (coupon.type === 'FLAT') {
            discountAmount = Math.min(coupon.value, sub);
            discountPercent = sub > 0 ? (discountAmount / sub) * 100 : 0;
        } else if (coupon.type === 'PERCENTAGE') {
            discountPercent = coupon.value * 100; // e.g. 0.2 → 20%
            discountAmount = sub * coupon.value;
        } else if (coupon.type === 'FREE_SESSION') {
            discountAmount = 0;
            discountPercent = 0;
        }

        res.json({
            coupon,
            source,
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            discountPercent: parseFloat(discountPercent.toFixed(4)),
            label: coupon.type === 'FLAT'
                ? `₱${coupon.value} Off ${source === 'PROMO' ? 'Promo' : 'Coupon'}`
                : coupon.type === 'PERCENTAGE'
                    ? `${coupon.value * 100}% Off ${source === 'PROMO' ? 'Promo' : 'Coupon'}`
                    : `Free Session Coupon`
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to validate coupon' });
    }
};

module.exports = {
    getRewards,
    createReward,
    updateReward,
    deleteReward,
    managePoints,
    getHistory,
    getMemberCoupons,
    validateCoupon
};
