const prisma = require('../config/prisma');

// Checkout (Member Shop)
const checkout = async (req, res) => {
    const { items, paymentMethod, paymentType, total } = req.body;
    const memberId = req.user.id; // Authenticated member

    // Frontend sends 'paymentType', backend previously expected 'paymentMethod'
    const method = paymentMethod || paymentType;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items in cart" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Calculate points
            const pointsAwarded = Math.floor(parseFloat(total) / 100);

            // Determine status and clean method
            const isPending = method === 'CASH_PENDING';
            const cleanMethod = isPending ? 'CASH' : method;
            const status = isPending ? 'PENDING' : 'COMPLETED';

            const payment = await tx.payment.create({
                data: {
                    amount: parseFloat(total),
                    type: 'STORE_SALE',
                    method: cleanMethod,
                    member: { connect: { id: Number(memberId) } },
                    pointsAwarded,
                    status: status
                }
            });

            // 2. Create Items and Deduct Stock
            for (const item of items) {
                // Frontend sends 'productId', backend previously expected 'id'
                const prodId = item.id || item.productId;

                await tx.paymentItem.create({
                    data: {
                        paymentId: payment.id,
                        productId: Number(prodId),
                        name: item.name,
                        type: 'PRODUCT',
                        quantity: Number(item.quantity),
                        unitPrice: parseFloat(item.price)
                    }
                });

                // Deduct stock
                await tx.product.update({
                    where: { id: Number(prodId) },
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
