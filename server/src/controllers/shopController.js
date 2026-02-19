const prisma = require('../config/prisma');

// Checkout (Member Shop)
const checkout = async (req, res) => {
    const { items, paymentMethod, paymentType, paymentMethodId, gcashReference, gcashDate } = req.body;
    const isMember = req.user?.role === 'MEMBER';
    const isTrainer = req.user?.role === 'TRAINER';
    if (!isMember && !isTrainer) {
        return res.status(403).json({ error: "Only members and trainers can checkout from this shop" });
    }
    const memberId = isMember ? Number(req.user.id) : null;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items in cart" });
    }

    try {
        const requestedMethod = String(paymentType || paymentMethod || '').toUpperCase();
        const isPendingCash = requestedMethod === 'CASH_PENDING';
        const method = isPendingCash ? 'CASH' : requestedMethod;
        const status = isPendingCash ? 'PENDING' : 'COMPLETED';
        const allowedMethods = ['CASH', 'CARD', 'GCASH'];
        if (!allowedMethods.includes(method)) {
            return res.status(400).json({ error: "Invalid payment method" });
        }
        const normalizedItems = items.map((item) => ({
            productId: Number(item.productId || item.id),
            quantity: Number(item.quantity)
        }));

        for (const item of normalizedItems) {
            if (!Number.isInteger(item.productId) || item.productId <= 0) {
                return res.status(400).json({ error: "Invalid product in cart" });
            }
            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                return res.status(400).json({ error: "Invalid quantity in cart" });
            }
        }

        const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
        const products = await prisma.product.findMany({
            where: { id: { in: uniqueProductIds } },
            select: { id: true, name: true, price: true, stock: true }
        });
        const productById = new Map(products.map((product) => [product.id, product]));

        let computedTotal = 0;
        for (const item of normalizedItems) {
            const product = productById.get(item.productId);
            if (!product) {
                return res.status(404).json({ error: `Product ${item.productId} not found` });
            }
            if (item.quantity > product.stock) {
                return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
            }
            computedTotal += Number(product.price) * item.quantity;
        }

        if (method !== 'CASH' && isMember) {
            const parsedMethodId = paymentMethodId !== undefined && paymentMethodId !== null ? Number(paymentMethodId) : null;
            if (!Number.isInteger(parsedMethodId) || parsedMethodId <= 0) {
                return res.status(400).json({ error: "Saved payment method is required for non-cash checkout" });
            }
            const savedMethod = await prisma.paymentMethod.findUnique({
                where: { id: parsedMethodId },
                select: { id: true, memberId: true, type: true }
            });
            if (!savedMethod || savedMethod.memberId !== Number(memberId)) {
                return res.status(403).json({ error: "Payment method is invalid for this member" });
            }
            if ((method === 'CARD' && savedMethod.type !== 'CARD') || (method === 'GCASH' && savedMethod.type !== 'GCASH')) {
                return res.status(400).json({ error: "Selected payment method type does not match checkout method" });
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const pointsAwarded = memberId && status === 'COMPLETED' ? Math.floor(computedTotal / 100) : 0;

            const payment = await tx.payment.create({
                data: {
                    amount: computedTotal,
                    type: isPendingCash ? 'IN_APP_PURCHASE' : 'STORE_SALE',
                    method,
                    ...(memberId ? { member: { connect: { id: memberId } } } : {}),
                    ...(isTrainer ? { cashier: { connect: { id: Number(req.user.id) } } } : {}),
                    pointsAwarded,
                    status,
                    externalRef: method === 'GCASH' ? (gcashReference || null) : null,
                    externalDate: method === 'GCASH' && gcashDate ? new Date(gcashDate) : null
                }
            });

            for (const item of normalizedItems) {
                const product = productById.get(item.productId);
                await tx.paymentItem.create({
                    data: {
                        paymentId: payment.id,
                        productId: item.productId,
                        name: product.name,
                        type: 'PRODUCT',
                        quantity: item.quantity,
                        unitPrice: Number(product.price)
                    }
                });

                // Pending cash checkout should not consume stock until cashier accepts payment.
                if (!isPendingCash) {
                    const updated = await tx.product.updateMany({
                        where: {
                            id: item.productId,
                            stock: { gte: item.quantity }
                        },
                        data: { stock: { decrement: item.quantity } }
                    });
                    if (updated.count === 0) {
                        throw new Error(`Insufficient stock for ${product.name}`);
                    }
                }
            }

            if (memberId && pointsAwarded > 0) {
                await tx.member.update({
                    where: { id: memberId },
                    data: { points: { increment: pointsAwarded } }
                });
            }

            return payment;
        });

        res.json(result);
    } catch (e) {
        console.error("Checkout error:", e);
        res.status(400).json({ error: e?.message || "Checkout failed" });
    }
};

// Get Member Orders
const getMemberOrders = async (req, res) => {
    try {
        if (req.user?.role === 'TRAINER') {
            const trainerPayments = await prisma.payment.findMany({
                where: {
                    cashierId: Number(req.user.id),
                    type: { in: ['STORE_SALE', 'IN_APP_PURCHASE'] }
                },
                include: { items: true },
                orderBy: { date: 'desc' }
            });
            return res.json(trainerPayments);
        }

        const payments = await prisma.payment.findMany({
            where: {
                memberId: req.user.id,
                type: { in: ['STORE_SALE', 'IN_APP_PURCHASE'] }
            },
            include: { items: true },
            orderBy: { date: 'desc' }
        });
        res.json(payments);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
};

module.exports = {
    checkout,
    getMemberOrders
};
