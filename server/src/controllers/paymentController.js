const prisma = require('../config/prisma');
const { getPosConfig } = require('../services/configService');
const bcrypt = require('bcryptjs');

const POS_PIN_MIN_LENGTH = 4;

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

    console.log("PAYMENT REQUEST:", JSON.stringify(req.body, null, 2));
    console.log("User:", req.user);

    try {
        const parsedAmount = parseFloat(amount);
        const pointsAwarded = resolvedMemberId ? Math.floor(parsedAmount / 100) : 0;
        const cashierId = req.user.role === 'MEMBER' ? null : req.user.id;

        // 1. Create Payment Record
        const payment = await prisma.payment.create({
            data: {
                amount: parsedAmount,
                type,
                method,
                memberId: resolvedMemberId,
                cashierId,
                pointsAwarded,
                cashTendered: method === 'CASH' ? (cashTendered !== undefined ? Number(cashTendered) : null) : null,
                changeDue: method === 'CASH' ? (changeDue !== undefined ? Number(changeDue) : null) : null,
                externalRef: method === 'GCASH' ? (externalRef || null) : null,
                externalDate: method === 'GCASH' && externalDate ? new Date(externalDate) : null,
                discount: req.body.discount ? Number(req.body.discount) : 0
            }
        });

        // 2. Process Items (Stock Deduction & Membership Updates)
        if (items && items.length > 0) {
            const paymentItems = items.map((item) => ({
                paymentId: payment.id,
                productId: item.type === 'PRODUCT' && item.id ? Number(item.id) : null,
                name: item.name || 'Item',
                type: item.type || 'PRODUCT',
                quantity: Number(item.quantity) || 1,
                unitPrice: parseFloat(item.price) || 0
            }));

            await prisma.paymentItem.createMany({ data: paymentItems });

            for (const item of items) {
                // A. Membership Plan Update
                if (item.type === 'PLAN') {
                    if (!resolvedMemberId) throw new Error("Member ID required for plan purchase");

                    const member = await prisma.member.findUnique({ where: { id: Number(resolvedMemberId) } });
                    if (!member) throw new Error("Member not found");

                    // Fetch authoritative plan details (Duration, etc)
                    const plan = await prisma.plan.findUnique({ where: { id: Number(item.id) } });
                    if (!plan) throw new Error(`Plan ${item.id} not found`);

                    // Calculate new expiry
                    const currentExpiry = new Date(member.expiryDate) > new Date() ? new Date(member.expiryDate) :
                        new Date();
                    const newExpiry = new Date(currentExpiry);
                    // Add duration (days)
                    newExpiry.setDate(newExpiry.getDate() + (plan.duration));

                    await prisma.member.update({
                        where: { id: Number(resolvedMemberId) },
                        data: {
                            expiryDate: newExpiry,
                            status: 'ACTIVE',
                            planId: item.id // Update their plan to the new one
                        }
                    });
                }

                // B. Stock Deduction (Products)
                // Only deduct if it's a tracked product (has an ID and is not a quick-add service or Plan)
                else if (item.id && (!item.type || item.type === 'PRODUCT')) { // Tracked products
                    // Check if it's actually a product in DB
                    try {
                        await prisma.product.update({
                            where: { id: Number(item.id) },
                            data: { stock: { decrement: item.quantity } }
                        });
                    } catch (err) {
                        // Ignore if product not found (might be a custom item)
                        console.warn(`Could not update stock for item ${item.id}`);
                    }
                }
            }
        }

        // 3. Award Loyalty Points (1 point per 100 PHP spent)
        if (memberId) {
            if (pointsAwarded > 0) {
                await prisma.member.update({
                    where: { id: Number(memberId) },
                    data: { points: { increment: pointsAwarded } }
                });
            }
        }

        res.json(payment);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
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
                    { type: 'IN_APP_PURCHASE' }
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
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate && endDate) {
        where.date = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
        };
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
