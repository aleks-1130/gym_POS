const prisma = require('../../config/prisma');

// Checkout (Member Shop)
const checkout = async (req, res) => {
    const { items, paymentMethod, paymentType, paymentMethodId, gcashReference, gcashDate, markAsSessionMaterial } = req.body;
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
        const isDeferredTrainerMaterial = isTrainer && Boolean(markAsSessionMaterial);
        const isPendingCash = requestedMethod === 'CASH_PENDING';
        const method = isDeferredTrainerMaterial ? 'COMMISSION_DEDUCTION' : (isPendingCash ? 'CASH' : requestedMethod);
        const status = isDeferredTrainerMaterial ? 'COMPLETED' : (isPendingCash ? 'PENDING' : 'COMPLETED');
        const { PAYMENT_METHODS } = require('../../config/businessConfig');
        const allowedMethods = PAYMENT_METHODS.map(m => m.value).concat(['COMMISSION_DEDUCTION', 'CARD']);
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

        const { tenantId } = req.user;
        const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
        const products = await prisma.product.findMany({
            where: { 
                id: { in: uniqueProductIds },
                gym: { tenantId } // Enforce Tenant Isolation
            },
            select: { 
                id: true, 
                name: true, 
                price: true,
                stocks: { where: { gymId: require('../../utils/context').getGymId() } }
            }
        });
        const productById = new Map(products.map((product) => [product.id, product]));

        let computedTotal = 0;
        for (const item of normalizedItems) {
            const product = productById.get(item.productId);
            if (!product) {
                return res.status(404).json({ error: `Product ${item.productId} not found` });
            }
            const currentStock = product.stocks?.[0]?.quantity || 0;
            if (item.quantity > currentStock) {
                return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
            }
            computedTotal += Number(product.price) * item.quantity;
        }

        if (isDeferredTrainerMaterial) {
            const trainerId = Number(req.user?.trainerId || 0);
            if (!Number.isInteger(trainerId) || trainerId <= 0) {
                return res.status(400).json({ error: "Trainer account is not linked" });
            }

            const trainer = await prisma.trainer.findFirst({
                where: { 
                    id: trainerId,
                    gym: { tenantId } // Enforce Tenant Isolation
                },
                select: { commissionRate: true }
            });
            if (!trainer) {
                return res.status(404).json({ error: "Trainer not found" });
            }

            const [unpaidSessions, unpaidClasses, unsettledMaterialItems] = await Promise.all([
                prisma.trainingSession.findMany({
                    where: { trainerId, status: 'COMPLETED', commissionPaid: false },
                    select: { price: true }
                }),
                prisma.classHistory.findMany({
                    where: { trainerId, commissionPaid: false },
                    select: { commissionAmount: true }
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
                        quantity: true,
                        returnedQuantity: true,
                        materialUsedQuantity: true,
                        materialSettledQuantity: true,
                        unitPrice: true
                    }
                })
            ]);

            const sessionCommissions = unpaidSessions.reduce((sum, s) => {
                return sum + (Number(s.price || 0) * Number(trainer.commissionRate || 0));
            }, 0);
            const classCommissions = unpaidClasses.reduce((sum, c) => {
                return sum + Number(c.commissionAmount || 0);
            }, 0);
            const outstandingMaterialDeductions = unsettledMaterialItems.reduce((sum, item) => {
                const unsettledUsedQty = Math.max(
                    0,
                    Number(item.materialUsedQuantity || 0) - Number(item.materialSettledQuantity || 0)
                );
                return sum + (unsettledUsedQty * Number(item.unitPrice || 0));
            }, 0);

            const availableCommission = Number((sessionCommissions + classCommissions - outstandingMaterialDeductions).toFixed(2));
            if (availableCommission < Number(computedTotal.toFixed(2))) {
                return res.status(400).json({
                    error: `Insufficient commission balance for tagged material purchase. Available: ${availableCommission.toFixed(2)}, Required: ${Number(computedTotal).toFixed(2)}`
                });
            }
        }

        if (method !== 'CASH' && method !== 'COMMISSION_DEDUCTION' && isMember) {
            const parsedMethodId = paymentMethodId !== undefined && paymentMethodId !== null ? Number(paymentMethodId) : null;
            if (!Number.isInteger(parsedMethodId) || parsedMethodId <= 0) {
                return res.status(400).json({ error: "Saved payment method is required for non-cash checkout" });
            }
            const savedMethod = await prisma.paymentMethod.findFirst({
                where: { 
                    id: parsedMethodId,
                    member: { gym: { tenantId } } // Enforce Tenant Isolation
                },
                select: { id: true, memberId: true, type: true }
            });
            if (!savedMethod || savedMethod.memberId !== Number(memberId)) {
                return res.status(403).json({ error: "Payment method is invalid for this member" });
            }
            const savedType = String(savedMethod.type || '').toUpperCase();
            const cardMatch = method === 'CARD' && (savedType === 'CARD' || savedType === 'CREDIT_CARD');
            const walletMatch = (method === 'GCASH' && savedType === 'GCASH') || (method === 'MAYA' && savedType === 'MAYA');
            if (!cardMatch && !walletMatch) {
                return res.status(400).json({ error: "Selected payment method type does not match checkout method" });
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const pointsAwarded = status === 'COMPLETED' && method !== 'COMMISSION_DEDUCTION' ? Math.floor(computedTotal / 100) : 0;
            const intendedForSessionMaterial = isTrainer && Boolean(markAsSessionMaterial);

            const payment = await tx.payment.create({
                data: {
                    amount: computedTotal,
                    type: isPendingCash ? 'IN_APP_PURCHASE' : 'STORE_SALE',
                    method,
                    ...(memberId ? { member: { connect: { id: memberId } } } : {}),
                    ...(isTrainer ? { cashier: { connect: { id: Number(req.user.id) } } } : {}),
                    pointsAwarded,
                    status,
                    externalRef: ['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) ? (gcashReference || null) : null,
                    externalDate: (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) && gcashDate) ? new Date(gcashDate) : null,
                    tenantId: req.user.tenantId
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
                        unitPrice: Number(product.price),
                        intendedForSessionMaterial,
                        tenantId: req.user.tenantId
                    }
                });

                // Pending cash checkout should not consume stock until cashier accepts payment.
                if (!isPendingCash) {
                    const gymId = require('../../utils/context').getGymId();
                    const updated = await tx.productStock.updateMany({
                        where: {
                            productId: item.productId,
                            gymId,
                            tenantId: req.user.tenantId,
                            quantity: { gte: item.quantity }
                        },
                        data: { quantity: { decrement: item.quantity } }
                    });
                    if (updated.count === 0) {
                        throw new Error(`Insufficient stock for ${product.name}`);
                    }
                }
            }

            if (memberId && pointsAwarded > 0) {
                const loyaltyService = require('../../services/loyaltyService');
                await loyaltyService.recordPoints({
                    memberId,
                    points: pointsAwarded,
                    type: 'EARNED',
                    description: 'Points earned from in-app store purchase',
                    gymId: require('../../utils/context').getGymId(),
                    tx
                });
            }
            if (!memberId && isTrainer && pointsAwarded > 0) {
                await tx.user.update({
                    where: { id: Number(req.user.id) },
                    data: { loyaltyPoints: { increment: pointsAwarded } }
                });
            }

            return payment;
        });

        if (req.body.sessionId) {
            try {
                const { redisClient } = require('../../config/redisClient');
                if (redisClient && redisClient.isOpen) {
                    await redisClient.del(`cart:reserve:${req.body.sessionId}`);
                }
            } catch (redisErr) {
                console.error("Failed to clear redis reservation:", redisErr);
            }
        }

        res.json(result);
    } catch (e) {
        console.error("Checkout error:", e);
        res.status(400).json({ error: e?.message || "Checkout failed" });
    }
};

const getMemberOrders = async (req, res) => {
    const { tenantId } = req.user;
    try {
        if (req.user?.role === 'TRAINER') {
            const trainerPayments = await prisma.payment.findMany({
                where: {
                    cashierId: Number(req.user.id),
                    type: { in: ['STORE_SALE', 'IN_APP_PURCHASE'] },
                    gym: { tenantId } // Enforce Tenant Isolation
                },
                include: { items: true },
                orderBy: { date: 'desc' }
            });
            return res.json(trainerPayments);
        }

        const payments = await prisma.payment.findMany({
            where: {
                memberId: req.user.id,
                type: { in: ['STORE_SALE', 'IN_APP_PURCHASE'] },
                gym: { tenantId } // Enforce Tenant Isolation
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
