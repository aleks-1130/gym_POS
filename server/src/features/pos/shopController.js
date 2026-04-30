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
                tenantId: Number(tenantId) // Enforce Tenant Isolation
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
                    tenantId: Number(tenantId) // Enforce Tenant Isolation
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
                    member: { tenantId: Number(tenantId) } // Enforce Tenant Isolation
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
                    tenant: { connect: { id: Number(req.user.tenantId) } },
                    gym: { connect: { id: Number(require('../../utils/context').getGymId()) } }
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
                        tenantId: req.user.tenantId,
                        gymId: require('../../utils/context').getGymId()
                    }
                });

                // Pending cash checkout should not consume stock until cashier accepts payment.
                if (!isPendingCash) {
                    const gymId = require('../../utils/context').getGymId();
                    
                    // 1. Deduct from branch-specific stock
                    const updatedBranch = await tx.productStock.updateMany({
                        where: {
                            productId: item.productId,
                            gymId,
                            tenantId: req.user.tenantId,
                            quantity: { gte: item.quantity }
                        },
                        data: { quantity: { decrement: item.quantity } }
                    });
                    if (updatedBranch.count === 0) {
                        throw new Error(`Insufficient stock for ${product.name}`);
                    }

                    // 2. Deduct from global product stock
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } }
                    });
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
                    tenantId: Number(req.user.tenantId),
                    tx
                });
            }
            if (!memberId && isTrainer && pointsAwarded > 0) {
                await tx.user.update({
                    where: { 
                        id: Number(req.user.id),
                        tenantId: Number(req.user.tenantId)
                    },
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
                    tenantId: Number(tenantId) // Enforce Tenant Isolation
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
                tenantId: Number(tenantId) // Enforce Tenant Isolation
            },
            include: { items: true },
            orderBy: { date: 'desc' }
        });
        res.json(payments);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
};

const claimBundleProduct = async (req, res) => {
    const { memberBundleId, bucketId, productId } = req.body;
    const memberId = req.user.id;
    const { tenantId } = req.user;
    const gymId = require('../../utils/context').getGymId();

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Find and lock bucket
            const bucket = await tx.memberBundleBucket.findUnique({
                where: { id: Number(bucketId) },
                include: { memberBundle: true }
            });

            if (!bucket || bucket.memberBundle.memberId !== Number(memberId) || bucket.memberBundle.status !== 'ACTIVE') {
                throw new Error("Invalid or inactive bundle bucket");
            }

            if (bucket.type !== 'PRODUCT') {
                throw new Error("This bucket is not for products");
            }

            if (bucket.productId && bucket.productId !== Number(productId)) {
                throw new Error("This bundle bucket is only for a specific product");
            }

            // If no specific productId, we can fallback to referencePrice matching
            if (!bucket.productId && bucket.referencePrice > 0) {
                 // We will check the product price against referencePrice later
            }

            if (bucket.remaining < 1) {
                throw new Error("No items remaining in this bundle bucket");
            }

            // 2. Find product for cost and stock
            const product = await tx.product.findUnique({
                where: { id: Number(productId) },
                include: { 
                    stocks: { where: { gymId } }
                }
            });

            if (!product || product.tenantId !== tenantId) {
                throw new Error("Product not found");
            }

            // Price Match Validation: if bucket is flexible (no productId), 
            // the claimed product must match the referencePrice
            if (!bucket.productId && bucket.referencePrice > 0) {
                if (Number(product.price) !== Number(bucket.referencePrice)) {
                    throw new Error(`Product price (${product.price}) does not match bundle reference price (${bucket.referencePrice})`);
                }
            }

            const currentStock = product.stocks?.[0]?.quantity || 0;
            if (currentStock < 1) {
                throw new Error("Insufficient stock for the requested product");
            }

            // 3. Decrement bucket
            await tx.memberBundleBucket.update({
                where: { id: bucket.id },
                data: { remaining: { decrement: 1 } }
            });

            // 4. Decrement stock
            await tx.productStock.updateMany({
                where: { productId: product.id, gymId, tenantId },
                data: { quantity: { decrement: 1 } }
            });

            // 5. Synchronize global product stock
            await tx.product.update({
                where: { id: product.id },
                data: { stock: { decrement: 1 } }
            });

            // 6. Record usage
            const usage = await tx.serviceBundleUsage.create({
                data: {
                    memberBundleId: bucket.memberBundleId,
                    type: 'PRODUCT_CLAIM',
                    targetId: product.id,
                    quantity: 1,
                    actualCost: product.supplyCost || 0,
                    tenantId
                }
            });

            const { checkAndCompleteBundle } = require('../members/memberController');
            await checkAndCompleteBundle(tx, bucket.memberBundleId);

            return { usage, productName: product.name };
        });

        res.json({
            message: `Successfully claimed ${result.productName} from bundle`,
            usage: result.usage
        });
    } catch (e) {
        console.error("Claim bundle product error:", e);
        res.status(400).json({ error: e.message });
    }
};

module.exports = {
    checkout,
    getMemberOrders,
    claimBundleProduct
};
