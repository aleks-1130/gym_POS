const prisma = require('../../config/prisma');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Calculate discount amount for a cart given a validated promo code.
 * Returns { discountAmount, breakdown[] }
 */
function calculateDiscount(promo, cartItems) {
    const { type, value, scope, productIds, categories, bogoConfig } = promo;
    let discountAmount = 0;
    const breakdown = [];

    if (type === 'PERCENTAGE') {
        let eligibleTotal = 0;
        for (const item of cartItems) {
            const inScope = isItemInScope(item, scope, productIds, categories);
            if (inScope) {
                const lineTotal = item.price * item.quantity;
                eligibleTotal += lineTotal;
                breakdown.push({ name: item.name, discount: lineTotal * (value / 100) });
            }
        }
        discountAmount = eligibleTotal * (value / 100);

    } else if (type === 'FLAT' || type === 'FIXED') {
        // For FLAT/FIXED: apply to eligible items proportionally, or flat off order
        if (scope === 'ORDER') {
            discountAmount = value;
            breakdown.push({ name: 'Order Discount', discount: value });
        } else {
            let eligibleTotal = 0;
            for (const item of cartItems) {
                if (isItemInScope(item, scope, productIds, categories)) {
                    eligibleTotal += item.price * item.quantity;
                }
            }
            // Cap discount to eligible total
            discountAmount = Math.min(value, eligibleTotal);
            breakdown.push({ name: 'Item Discount', discount: discountAmount });
        }

    } else if (type === 'BOGO') {
        // BOGO: for every buyQty, customer gets getQty free (cheapest eligible item)
        const { buyQty = 1, getQty = 1, getProductId } = bogoConfig || {};
        const eligibleItems = cartItems.filter(item =>
            isItemInScope(item, scope, productIds, categories)
        );
        const totalEligibleQty = eligibleItems.reduce((sum, i) => sum + i.quantity, 0);
        const freeSets = Math.floor(totalEligibleQty / (buyQty + getQty));

        if (freeSets > 0) {
            // Find cheapest eligible item for the free item(s)
            let freeItem = null;
            if (getProductId) {
                freeItem = cartItems.find(i => i.productId === getProductId);
            } else {
                // Cheapest eligible item
                freeItem = eligibleItems.sort((a, b) => a.price - b.price)[0];
            }
            if (freeItem) {
                const freeQty = freeSets * getQty;
                const itemDiscount = freeItem.price * Math.min(freeQty, freeItem.quantity);
                discountAmount = itemDiscount;
                breakdown.push({ name: `${freeItem.name} (BOGO Free)`, discount: itemDiscount });
            }
        }
    }

    return { discountAmount: Math.round(discountAmount * 100) / 100, breakdown };
}

function isItemInScope(item, scope, productIds, categories) {
    if (scope === 'ORDER') return true;
    if (scope === 'PRODUCT') return productIds.includes(item.productId);
    if (scope === 'CATEGORY') return categories.includes(item.category);
    return true;
}

// ─── Validate & compute a promo code (used by Apply and Checkout) ────────────

const applyPromoCode = async (req, res) => {
    try {
        const { code, cartItems } = req.body;
        if (!code || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ error: 'Code and cartItems are required.' });
        }

        const { tenantId, gymId: userGymId } = req.user;
        const gymId = userGymId || req.gymId;
        const promo = await prisma.promoCode.findFirst({
            where: { 
                code: code.toUpperCase(),
                tenantId: tenantId, // Enforce Tenant Isolation
                OR: [
                    { gymId: Number(gymId) },
                    { gymId: null }
                ]
            }
        });

        if (!promo) {
            // Fallback to legacy Coupon
            const gymId = req.user.gymId || req.gymId;
            const coupon = await prisma.coupon.findFirst({
                where: { 
                    code: code.toUpperCase(),
                    gymId: Number(gymId)
                }
            });

            if (!coupon) return res.status(404).json({ error: 'Code not found.' });
            if (coupon.status !== 'ACTIVE') return res.status(400).json({ error: 'This coupon is not active or already used.' });

            // Coupons are usually flat or percentage on total (legacy behavior)
            const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let discountAmount = 0;
            if (coupon.type === 'PERCENTAGE') {
                discountAmount = subtotal * (coupon.value / 100);
            } else {
                discountAmount = Math.min(coupon.value, subtotal);
            }

            return res.json({
                couponId: coupon.id,
                code: coupon.code,
                type: coupon.type,
                discountAmount,
                label: `Loyalty ${coupon.type}`,
                source: 'COUPON',
                description: `Loyalty discount for ${coupon.memberId || 'Guest'}`
            });
        }

        if (!promo.isActive) return res.status(400).json({ error: 'This promo code is no longer active.' });
        if (promo.expiryDate && new Date() > new Date(promo.expiryDate)) {
            return res.status(400).json({ error: 'This promo code has expired.' });
        }
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
            return res.status(400).json({ error: 'This promo code has reached its maximum uses.' });
        }

        const { discountAmount, breakdown } = calculateDiscount(promo, cartItems);
        return res.json({
            promoCodeId: promo.id,
            code: promo.code,
            type: promo.type,
            discountAmount,
            breakdown,
            label: promo.type,
            source: 'PROMO',
            description: promo.description
        });
    } catch (e) {
        console.error('[PromoCode] Apply error:', e);
        res.status(500).json({ error: 'Failed to apply promo code.' });
    }
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const getPromoCodes = async (req, res) => {
    try {
        const { tenantId, gymId: userGymId } = req.user;
        const gymId = userGymId || req.gymId;
        const promos = await prisma.promoCode.findMany({ 
            where: { 
                tenantId: tenantId, // Enforce Tenant Isolation
                OR: [
                    { gymId: Number(gymId) },
                    { gymId: null }
                ]
            },
            orderBy: { createdAt: 'desc' } 
        });
        res.json(promos);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch promo codes' });
    }
};

const createPromoCode = async (req, res) => {
    try {
        const {
            code, type, value, description, maxUses, expiryDate, isGlobal,
            scope = 'ORDER', productIds = [], categories = [], bogoConfig = null
        } = req.body;

        const { tenantId, gymId: userGymId } = req.user;
        const gymId = userGymId || req.gymId;
        const targetGymId = isGlobal ? null : Number(gymId);

        const existing = await prisma.promoCode.findFirst({ 
            where: { 
                code: code.toUpperCase(),
                gymId: targetGymId,
                tenantId: tenantId
            } 
        });
        if (existing) return res.status(400).json({ error: 'Promo code already exists' });

        const promo = await prisma.promoCode.create({
            data: {
                code: code.toUpperCase(),
                type,
                value: Number(value),
                description,
                maxUses: maxUses ? Number(maxUses) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                scope,
                productIds: Array.isArray(productIds) ? productIds.map(Number) : [],
                categories: Array.isArray(categories) ? categories : [],
                bogoConfig: bogoConfig || null,
                gymId: targetGymId,
                tenantId: tenantId
            }
        });
        res.status(201).json(promo);
    } catch (e) {
        console.error('[PromoCode] Create error:', e);
        res.status(500).json({ error: 'Failed to create promo code' });
    }
};

const updatePromoCode = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, description, maxUses, expiryDate, scope, productIds, categories, bogoConfig } = req.body;

        const { tenantId, gymId: userGymId } = req.user;
        const gymId = userGymId || req.gymId;
        const promo = await prisma.promoCode.update({
            where: { 
                id: Number(id),
                tenantId: tenantId, // Enforce Tenant Isolation
                OR: [
                    { gymId: Number(gymId) },
                    { gymId: null }
                ]
            },
            data: {
                ...(isActive !== undefined && { isActive }),
                ...(description !== undefined && { description }),
                ...(maxUses !== undefined && { maxUses: maxUses ? Number(maxUses) : null }),
                ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
                ...(scope !== undefined && { scope }),
                ...(productIds !== undefined && { productIds: productIds.map(Number) }),
                ...(categories !== undefined && { categories }),
                ...(bogoConfig !== undefined && { bogoConfig })
            }
        });
        res.json(promo);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update promo code' });
    }
};

const deletePromoCode = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId, gymId: userGymId } = req.user;
        const gymId = userGymId || req.gymId;
        await prisma.promoCode.update({ 
            where: { 
                id: Number(id),
                tenantId: tenantId, // Enforce Tenant Isolation
                OR: [
                    { gymId: Number(gymId) },
                    { gymId: null }
                ]
            }, 
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
    deletePromoCode,
    applyPromoCode,
    calculateDiscount
};
