const prisma = require('../config/prisma');

// Checkout (Member Shop)
const checkout = async (req, res) => {
    const { items, paymentMethod, total } = req.body;
    const memberId = req.user.id; // Authenticated member

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items in cart" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Payment
            // Note: For 'CASH' (Pay at Counter), we might set status to 'PENDING'?
            // But usually shop checkout implies immediate payment or intent.
            // Let's assume COMPLETED for now if it's In-App (e.g. Card/GCash simulated), 
            // or PENDING if Cash?
            // Existing logic didn't specify status, so it defaults to COMPLETED usually?
            // Payment model has status default 'COMPLETED'?
            // Let's check schema/previous usage.
            // Previous 'checkout' logic set status? No, default.

            // Calculate points
            const pointsAwarded = Math.floor(parseFloat(total) / 100);

            const payment = await tx.payment.create({
                data: {
                    amount: parseFloat(total),
                    type: 'STORE_SALE', // or IN_APP_PURCHASE
                    method: paymentMethod,
                    memberId: memberId,
                    pointsAwarded,
                    // If method is CASH, maybe we should mark it? 
                    // But for Member App, usually they pay via 'GCASH' or 'CARD'.
                    // If they select 'CASH' (Pay at Counter), it's a reservation/order?
                    // Let's assume standard flow.
                }
            });

            // 2. Create Items and Deduct Stock
            for (const item of items) {
                await tx.paymentItem.create({
                    data: {
                        paymentId: payment.id,
                        productId: Number(item.id),
                        name: item.name,
                        type: 'PRODUCT',
                        quantity: Number(item.quantity),
                        unitPrice: parseFloat(item.price)
                    }
                });

                // Deduct stock
                await tx.product.update({
                    where: { id: Number(item.id) },
                    data: { stock: { decrement: Number(item.quantity) } }
                });
            }

            // 3. Award Points
            if (pointsAwarded > 0) {
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
        res.status(500).json({ error: "Checkout failed: " + e.message });
    }
};

// Get Member Orders
const getMemberOrders = async (req, res) => {
    try {
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
