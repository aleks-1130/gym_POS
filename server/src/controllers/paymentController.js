const prisma = require('../config/prisma');
const { getPosConfig } = require('../services/configService');
const bcrypt = require('bcryptjs');

const POS_PIN_MIN_LENGTH = 4;

const getPlanClassSessions = (plan) => {
    if (!plan || !plan.includesClasses) return 0;
    const included = Number(plan.includedClassSessions || 0);
    return Number.isInteger(included) && included > 0 ? included : 0;
};

// Get Payment Details
const getPaymentDetails = async (req, res) => {
    const { id } = req.params;

    // Authorization check
    if (req.user.role === 'MEMBER' && req.user.id !== Number(id)) {
        return res.sendStatus(403);
    }

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: Number(id) },
            include: {
                member: true,
                items: true,
                cashier: { select: { id: true, name: true, role: true } }
            }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });

        // Staff constraint (optional)
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id && payment.type !== 'IN_APP_PURCHASE') {
            // Allow Staff to view but restrict if needed.
            // Original logic had strict check here:
            return res.status(403).json({ error: "Access denied" });
        }

        res.json(payment);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// POS Payment Creation
const createPayment = async (req, res) => {
    const { amount, type, method, memberId, items, discount, cashTendered, changeDue, externalRef, externalDate } = req.body;
    const resolvedMemberId = req.user.role === 'MEMBER'
        ? req.user.id
        : (memberId ? Number(memberId) : null);

    try {
        const badRequest = (message) => {
            const err = new Error(message);
            err.status = 400;
            throw err;
        };

        if (!type) badRequest("Payment type is required");

        const allowedMethods = ['CASH', 'CARD', 'GCASH'];
        if (!allowedMethods.includes(method)) badRequest("Invalid payment method");

        const normalizedDiscount = discount !== undefined ? Number(discount) : 0;
        if (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0) badRequest("Invalid discount value");

        const normalizedItems = Array.isArray(items)
            ? items.map((item) => ({
                ...item,
                type: item.type || 'PRODUCT',
                productId: Number(item.id || item.productId),
                quantity: Number(item.quantity)
            }))
            : [];

        let authoritativeAmount = Number(amount);
        if (normalizedItems.length > 0) {
            const productIds = [...new Set(
                normalizedItems
                    .filter((item) => item.type === 'PRODUCT' && Number.isInteger(item.productId) && item.productId > 0)
                    .map((item) => item.productId)
            )];
            const planIds = [...new Set(
                normalizedItems
                    .filter((item) => item.type === 'PLAN')
                    .map((item) => Number(item.id || item.planId || item.productId))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )];
            const classPackageIds = [...new Set(
                normalizedItems
                    .filter((item) => item.type === 'CLASS_PACKAGE')
                    .map((item) => Number(item.id || item.classPackageId || item.packageId || item.productId))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )];

            const [products, plans, classPackages] = await Promise.all([
                productIds.length
                    ? prisma.product.findMany({
                        where: { id: { in: productIds } },
                        select: { id: true, name: true, price: true, stock: true }
                    })
                    : Promise.resolve([]),
                planIds.length
                    ? prisma.plan.findMany({
                        where: { id: { in: planIds } },
                        select: { id: true, name: true, price: true, duration: true, includesClasses: true, includedClassSessions: true }
                    })
                    : Promise.resolve([]),
                classPackageIds.length
                    ? prisma.classSessionPackage.findMany({
                        where: { id: { in: classPackageIds }, isActive: true },
                        select: { id: true, name: true, price: true, sessions: true }
                    })
                    : Promise.resolve([])
            ]);

            const productById = new Map(products.map((product) => [product.id, product]));
            const planById = new Map(plans.map((plan) => [plan.id, plan]));
            const classPackageById = new Map(classPackages.map((pkg) => [pkg.id, pkg]));

            authoritativeAmount = 0;
            for (const item of normalizedItems) {
                if (!Number.isInteger(item.quantity) || item.quantity <= 0) badRequest("Invalid item quantity");

                if (item.type === 'PRODUCT') {
                    const product = productById.get(item.productId);
                    if (!product) badRequest(`Product ${item.productId} not found`);
                    if (item.quantity > product.stock) badRequest(`Insufficient stock for ${product.name}`);
                    authoritativeAmount += Number(product.price) * item.quantity;
                    continue;
                }

                if (item.type === 'PLAN') {
                    const planId = Number(item.id || item.planId || item.productId);
                    const plan = planById.get(planId);
                    if (!plan) badRequest(`Plan ${planId} not found`);
                    authoritativeAmount += Number(plan.price) * item.quantity;
                    continue;
                }
                if (item.type === 'CLASS_PACKAGE') {
                    const packageId = Number(item.id || item.classPackageId || item.packageId || item.productId);
                    const classPackage = classPackageById.get(packageId);
                    if (!classPackage) badRequest(`Class package ${packageId} not found`);
                    authoritativeAmount += Number(classPackage.price) * item.quantity;
                    continue;
                }

                const clientPrice = Number(item.price);
                if (!Number.isFinite(clientPrice) || clientPrice < 0) badRequest("Invalid custom item price");
                authoritativeAmount += clientPrice * item.quantity;
            }
        } else if (!Number.isFinite(authoritativeAmount) || authoritativeAmount < 0) {
            badRequest("Invalid payment amount");
        }

        const normalizedCashTendered = method === 'CASH'
            ? (cashTendered !== undefined && cashTendered !== null && cashTendered !== '' ? Number(cashTendered) : null)
            : null;
        if (method === 'CASH' && (!Number.isFinite(normalizedCashTendered) || normalizedCashTendered < authoritativeAmount)) {
            badRequest("Cash tendered is invalid or less than amount");
        }

        const normalizedChangeDue = method === 'CASH'
            ? (changeDue !== undefined && changeDue !== null && changeDue !== '' ? Number(changeDue) : (normalizedCashTendered - authoritativeAmount))
            : null;
        if (method === 'CASH' && !Number.isFinite(normalizedChangeDue)) badRequest("Invalid change due");

        let normalizedExternalDate = null;
        if (method === 'GCASH' && externalDate) {
            const parsedExternalDate = new Date(externalDate);
            if (Number.isNaN(parsedExternalDate.getTime())) badRequest("Invalid external payment date");
            normalizedExternalDate = parsedExternalDate;
        }

        const pointsAwarded = resolvedMemberId ? Math.floor(authoritativeAmount / 100) : 0;
        const resolvedCashierId = req.user.role === 'MEMBER' ? null : req.user.id;

        const payment = await prisma.$transaction(async (tx) => {
            const paymentCreateData = {
                amount: authoritativeAmount,
                type,
                method,
                ...(resolvedMemberId ? { member: { connect: { id: Number(resolvedMemberId) } } } : {}),
                ...(resolvedCashierId ? { cashier: { connect: { id: Number(resolvedCashierId) } } } : {}),
                pointsAwarded,
                cashTendered: normalizedCashTendered,
                changeDue: normalizedChangeDue,
                externalRef: method === 'GCASH' ? (externalRef || null) : null,
                externalDate: normalizedExternalDate,
                discount: normalizedDiscount
            };

            const removableOptionalFields = new Set(['discount', 'cashTendered', 'changeDue', 'externalRef', 'externalDate']);
            let createdPayment;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    createdPayment = await tx.payment.create({ data: paymentCreateData });
                    break;
                } catch (err) {
                    const unknownArg = /Unknown argument `([^`]+)`/.exec(err?.message || '')?.[1];
                    if (!unknownArg || !removableOptionalFields.has(unknownArg) || !(unknownArg in paymentCreateData)) {
                        throw err;
                    }
                    delete paymentCreateData[unknownArg];
                }
            }

            if (normalizedItems.length > 0) {
                const productIds = [...new Set(
                    normalizedItems
                        .filter((item) => item.type === 'PRODUCT' && Number.isInteger(item.productId) && item.productId > 0)
                        .map((item) => item.productId)
                )];
                const planIds = [...new Set(
                    normalizedItems
                        .filter((item) => item.type === 'PLAN')
                        .map((item) => Number(item.id || item.planId || item.productId))
                        .filter((id) => Number.isInteger(id) && id > 0)
                )];
                const classPackageIds = [...new Set(
                    normalizedItems
                        .filter((item) => item.type === 'CLASS_PACKAGE')
                        .map((item) => Number(item.id || item.classPackageId || item.packageId || item.productId))
                        .filter((id) => Number.isInteger(id) && id > 0)
                )];

                const [products, plans, classPackages] = await Promise.all([
                    productIds.length
                        ? tx.product.findMany({
                            where: { id: { in: productIds } },
                            select: { id: true, name: true, price: true }
                        })
                        : Promise.resolve([]),
                    planIds.length
                        ? tx.plan.findMany({
                            where: { id: { in: planIds } },
                            select: { id: true, name: true, price: true, duration: true, includesClasses: true, includedClassSessions: true }
                        })
                        : Promise.resolve([]),
                    classPackageIds.length
                        ? tx.classSessionPackage.findMany({
                            where: { id: { in: classPackageIds }, isActive: true },
                            select: { id: true, name: true, price: true, sessions: true }
                        })
                        : Promise.resolve([])
                ]);
                const productById = new Map(products.map((product) => [product.id, product]));
                const planById = new Map(plans.map((plan) => [plan.id, plan]));
                const classPackageById = new Map(classPackages.map((pkg) => [pkg.id, pkg]));

                const paymentItems = normalizedItems.map((item) => {
                    const planId = Number(item.id || item.planId || item.productId);
                    const classPackageId = Number(item.id || item.classPackageId || item.packageId || item.productId);
                    const product = item.type === 'PRODUCT' ? productById.get(item.productId) : null;
                    const plan = item.type === 'PLAN' ? planById.get(planId) : null;
                    const classPackage = item.type === 'CLASS_PACKAGE' ? classPackageById.get(classPackageId) : null;
                    return {
                        type: item.type,
                        paymentId: createdPayment.id,
                        productId: item.type === 'PRODUCT' ? item.productId : null,
                        name: product?.name || plan?.name || classPackage?.name || item.name || 'Item',
                        quantity: item.quantity,
                        unitPrice: item.type === 'PRODUCT'
                            ? Number(product.price)
                            : item.type === 'PLAN'
                                ? Number(plan.price)
                                : item.type === 'CLASS_PACKAGE'
                                    ? Number(classPackage.price)
                                : (parseFloat(item.price) || 0)
                    };
                });
                await tx.paymentItem.createMany({ data: paymentItems });

                for (const item of normalizedItems) {
                    if (item.type === 'PLAN') {
                        if (!resolvedMemberId) throw new Error("Member ID required for plan purchase");
                        const member = await tx.member.findUnique({ where: { id: Number(resolvedMemberId) } });
                        if (!member) throw new Error("Member not found");

                        const planId = Number(item.id || item.planId || item.productId);
                        const plan = planById.get(planId);
                        if (!plan) throw new Error(`Plan ${planId} not found`);

                        const currentExpiry = member.expiryDate && new Date(member.expiryDate) > new Date()
                            ? new Date(member.expiryDate)
                            : new Date();
                        const newExpiry = new Date(currentExpiry);
                        newExpiry.setDate(newExpiry.getDate() + plan.duration);

                        await tx.member.update({
                            where: { id: Number(resolvedMemberId) },
                            data: {
                                expiryDate: newExpiry,
                                status: 'ACTIVE',
                                planId,
                                ...(getPlanClassSessions(plan) > 0
                                    ? { classSessionsRemaining: { increment: getPlanClassSessions(plan) } }
                                    : {})
                            }
                        });
                    } else if (item.type === 'PRODUCT' && item.productId) {
                        const updated = await tx.product.updateMany({
                            where: {
                                id: item.productId,
                                stock: { gte: item.quantity }
                            },
                            data: { stock: { decrement: item.quantity } }
                        });
                        if (updated.count === 0) throw new Error(`Insufficient stock for product ${item.productId}`);
                    } else if (item.type === 'CLASS_PACKAGE') {
                        if (!resolvedMemberId) throw new Error("Member ID required for class package purchase");
                        const packageId = Number(item.id || item.classPackageId || item.packageId || item.productId);
                        const classPackage = classPackageById.get(packageId);
                        if (!classPackage) throw new Error(`Class package ${packageId} not found`);

                        const sessionsToAdd = Number(classPackage.sessions) * Number(item.quantity);
                        await tx.member.update({
                            where: { id: Number(resolvedMemberId) },
                            data: {
                                classSessionsRemaining: { increment: sessionsToAdd },
                                classSessionsPurchased: { increment: sessionsToAdd }
                            }
                        });
                    }
                }
            }

            if (resolvedMemberId && pointsAwarded > 0) {
                await tx.member.update({
                    where: { id: Number(resolvedMemberId) },
                    data: { points: { increment: pointsAwarded } }
                });
            }

            return createdPayment;
        });

        res.json(payment);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || "Payment failed" });
    }
};

const getAllPayments = async (req, res) => {
    // Member: see own payments
    if (req.user.role === 'MEMBER') {
        const videos = await prisma.payment.findMany({
            where: { memberId: req.user.id },
            take: 50,
            orderBy: { date: 'desc' }
        });
        return res.json(videos);
    }

    if (req.user.role === 'STAFF') {
        const payments = await prisma.payment.findMany({
            where: {
                OR: [
                    { cashierId: req.user.id },
                    { type: 'IN_APP_PURCHASE' },
                    { type: 'TRAINING' }
                ]
            },
            take: 50,
            orderBy: { date: 'desc' },
            include: {
                member: true,
                cashier: { select: { id: true, name: true, role: true } }
            }
        });
        return res.json(payments);
    }

    // Staff/Admin: see all
    const { startDate, endDate, page, limit } = req.query;
    const where = {};
    if (startDate && endDate) {
        where.date = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
        };
    }

    if (page && limit) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 10);
        const skip = (pageNum - 1) * limitNum;

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { date: 'desc' },
                include: {
                    member: true,
                    cashier: { select: { id: true, name: true, role: true } }
                }
            }),
            prisma.payment.count({ where })
        ]);

        return res.json({
            data: payments,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    }

    const payments = await prisma.payment.findMany({
        where,
        take: startDate ? undefined : 50,
        orderBy: { date: 'desc' },
        include: {
            member: true,
            cashier: { select: { id: true, name: true, role: true } }
        }
    });
    res.json(payments);
};

const returnPaymentItems = async (req, res) => {
    const paymentId = Number(req.params.id);
    const { pin, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No return items provided" });
    }

    try {
        const config = await getPosConfig();
        if (!config.returnPinHash) {
            return res.status(400).json({ error: "Return PIN is not configured" });
        }
        if (!pin || !(await bcrypt.compare(String(pin), config.returnPinHash))) {
            return res.status(403).json({ error: "Invalid PIN" });
        }

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { items: true }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (payment.status !== 'COMPLETED' && payment.status !== 'RETURNED') {
            return res.status(400).json({ error: "Only completed payments can be returned" });
        }

        let refundAmount = 0;
        let totalReturnedQty = 0;

        for (const reqItem of items) {
            const itemId = Number(reqItem.itemId);
            const qty = Number(reqItem.quantity) || 0;
            if (!itemId || qty <= 0) continue;

            const item = payment.items.find(i => i.id === itemId);
            if (!item) continue;
            if (!item.productId) continue;

            const availableQty = item.quantity - (item.returnedQuantity || 0);
            const returnQty = Math.min(availableQty, qty);
            if (returnQty <= 0) continue;

            refundAmount += returnQty * item.unitPrice;
            totalReturnedQty += returnQty;

            await prisma.paymentItem.update({
                where: { id: item.id },
                data: { returnedQuantity: { increment: returnQty } }
            });

            if (item.productId) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: returnQty } }
                });
            }
        }

        if (refundAmount <= 0) {
            return res.status(400).json({ error: "Nothing to return" });
        }

        const pointsReversal = payment.memberId ? Math.floor(refundAmount / 100) : 0;
        if (pointsReversal > 0) {
            const member = await prisma.member.findUnique({ where: { id: payment.memberId } });
            if (member) {
                await prisma.member.update({
                    where: { id: payment.memberId },
                    data: { points: { decrement: pointsReversal } }
                });
            }
        }

        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'RETURNED',
                refundedAmount: { increment: refundAmount },
                pointsReversed: { increment: pointsReversal }
            },
            include: { member: true, items: true }
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to return items" });
    }
};

const voidPayment = async (req, res) => {
    const { pin } = req.body;
    const paymentId = Number(req.params.id);

    try {
        const config = await getPosConfig();
        if (!config.voidPinHash) {
            return res.status(400).json({ error: "Void PIN is not configured" });
        }
        if (!pin || !(await bcrypt.compare(String(pin), config.voidPinHash))) {
            return res.status(403).json({ error: "Invalid PIN" });
        }

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { items: true }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (payment.status !== 'COMPLETED') {
            return res.status(400).json({ error: "Only completed payments can be voided" });
        }

        for (const item of payment.items) {
            if (item.productId) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });
            }
        }

        const pointsReversal = payment.memberId ? (payment.pointsAwarded || 0) : 0;
        if (pointsReversal > 0) {
            const member = await prisma.member.findUnique({ where: { id: payment.memberId } });
            if (member) {
                await prisma.member.update({
                    where: { id: payment.memberId },
                    data: { points: { decrement: pointsReversal } }
                });
            }
        }

        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'VOIDED',
                pointsReversed: { increment: pointsReversal }
            },
            include: { member: true, items: true }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to void payment" });
    }
};

const getPosSettings = async (req, res) => {
    try {
        const config = await getPosConfig();
        res.json({
            hasVoidPin: Boolean(config.voidPinHash),
            hasReturnPin: Boolean(config.returnPinHash)
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load POS settings" });
    }
};

const updatePosSettings = async (req, res) => {
    const { voidPin, returnPin } = req.body;
    try {
        if (voidPin === undefined && returnPin === undefined) {
            return res.status(400).json({ error: "No settings provided" });
        }

        const data = {};

        if (voidPin !== undefined) {
            if (voidPin === '') {
                data.voidPinHash = null;
            } else if (String(voidPin).length < POS_PIN_MIN_LENGTH) {
                return res.status(400).json({ error: `Void PIN must be at least ${POS_PIN_MIN_LENGTH} digits` });
            } else {
                data.voidPinHash = await bcrypt.hash(String(voidPin), 10);
            }
        }

        if (returnPin !== undefined) {
            if (returnPin === '') {
                data.returnPinHash = null;
            } else if (String(returnPin).length < POS_PIN_MIN_LENGTH) {
                return res.status(400).json({ error: `Return PIN must be at least ${POS_PIN_MIN_LENGTH} digits` });
            } else {
                data.returnPinHash = await bcrypt.hash(String(returnPin), 10);
            }
        }

        const config = await getPosConfig();
        await prisma.posConfig.update({
            where: { id: config.id },
            data
        });

        res.json({ message: "POS settings updated" });
    } catch (e) {
        res.status(500).json({ error: "Failed to update POS settings" });
    }
};

const getMyTransactions = async (req, res) => {
    try {
        const memberId = req.user.id;
        const payments = await prisma.payment.findMany({
            where: { memberId },
            include: {
                items: true,
                cashier: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

const getPaymentMethods = async (req, res) => {
    try {
        let targetMemberId;
        if (req.user.role === 'MEMBER') {
            targetMemberId = req.user.id;
        } else {
            return res.json([]);
        }

        const methods = await prisma.paymentMethod.findMany({
            where: { memberId: targetMemberId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true, last4: true, brand: true, expiry: true, isDefault: true }
        });
        res.json(methods);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch payment methods" });
    }
};

const addPaymentMethod = async (req, res) => {
    try {
        const { cardNumber, expiry, cvv, brand } = req.body;
        const member = await prisma.member.findUnique({ where: { id: req.user.id } });

        if (!member) {
            return res.status(404).json({ error: "Member profile not found" });
        }

        const last4 = cardNumber.slice(-4);
        const token = `tok_${Math.random().toString(36).substr(2, 9)}`;

        const method = await prisma.paymentMethod.create({
            data: {
                memberId: member.id,
                type: 'CREDIT_CARD',
                last4,
                brand: brand || 'Visa',
                expiry,
                token,
                isDefault: false
            }
        });
        res.json({ message: "Card added successfully", method: { ...method, token: undefined } });
    } catch (e) {
        res.status(500).json({ error: "Failed to add card" });
    }
};

const deletePaymentMethod = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const method = await prisma.paymentMethod.findUnique({ where: { id } });
        if (!method) return res.status(404).json({ error: "Method not found" });

        if (req.user.role === 'MEMBER' && method.memberId !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        await prisma.paymentMethod.delete({ where: { id } });
        res.json({ message: "Payment method removed" });
    } catch (e) {
        res.status(500).json({ error: "Failed to remove payment method" });
    }
};

module.exports = {
    getPaymentDetails,
    createPayment,
    getAllPayments,
    returnPaymentItems,
    voidPayment,
    getPosSettings,
    updatePosSettings,
    getMyTransactions,
    getPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod
};
