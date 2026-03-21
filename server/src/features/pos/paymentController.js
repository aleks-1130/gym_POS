const prisma = require('../../config/prisma');
const { getPosConfig } = require('../../services/configService');
const { getReceiptSettings, saveReceiptSettings } = require('../../services/receiptSettingsService');
const notificationService = require('../../services/notificationService');
const bcrypt = require('bcryptjs');
const { calculateDiscount } = require('./promoController');

const POS_PIN_MIN_LENGTH = 4;
const MAX_DISCOUNT_PRESETS = 50;

const normalizeDiscountPresets = (rawPresets) => {
    if (rawPresets === undefined || rawPresets === null) return [];
    if (!Array.isArray(rawPresets)) {
        throw new Error("Discount presets must be an array");
    }
    if (rawPresets.length > MAX_DISCOUNT_PRESETS) {
        throw new Error(`Maximum of ${MAX_DISCOUNT_PRESETS} discount presets allowed`);
    }

    return rawPresets.map((preset, index) => {
        const name = String(preset?.name || '').trim();
        const rate = Number(preset?.rate);
        const id = String(preset?.id || `preset_${index + 1}`).trim();
        const iconInput = String(preset?.icon || 'local_offer').trim();
        const icon = /^[a-z0-9_]+$/i.test(iconInput) ? iconInput : 'local_offer';

        if (!name) {
            throw new Error(`Discount preset #${index + 1} is missing a name`);
        }
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
            throw new Error(`Discount preset "${name}" must be between 0 and 100`);
        }

        return {
            id,
            name,
            rate: Number(rate.toFixed(2)),
            icon
        };
    });
};

const getStoredDiscountPresets = async (gymId) => {
    // We can use Prisma Client since we added gymId to PosConfig
    const config = await prisma.posConfig.findFirst({
        where: { gymId: Number(gymId) }
    });
    return normalizeDiscountPresets(config?.discountPresets);
};

const saveDiscountPresets = async (gymId, presets) => {
    const config = await prisma.posConfig.findFirst({
        where: { gymId: Number(gymId) }
    });
    if (config) {
        await prisma.posConfig.update({
            where: { id: config.id },
            data: { discountPresets: presets || [] }
        });
    }
};

const getPlanClassSessions = (plan) => {
    if (!plan || !plan.includesClasses) return 0;
    const included = Number(plan.includedClassSessions || 0);
    return Number.isInteger(included) && included > 0 ? included : 0;
};

const isMemberMembershipExpired = (member) => {
    if (!member) return true;
    if (String(member.status || '').toUpperCase() === 'EXPIRED') return true;
    if (!member.expiryDate) return false;

    const expiryDate = new Date(member.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) return true;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return expiryDate < todayStart;
};

const getTrainerBuyerIdFromPayment = (payment) => {
    if (!payment) return null;
    if (payment.memberId) return null;
    const role = String(payment.cashier?.role || '').toUpperCase();
    return role === 'TRAINER' && payment.cashierId ? Number(payment.cashierId) : null;
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
        if (
            req.user.role === 'STAFF' &&
            payment.cashierId !== req.user.id &&
            !['IN_APP_PURCHASE', 'STORE_SALE'].includes(String(payment.type || '').toUpperCase())
        ) {
            // Allow Staff to view but restrict if needed.
            // Original logic had strict check here:
            return res.status(403).json({ error: "Access denied" });
        }

        let trainingSessions = [];
        const isTrainingPayment = String(payment.type || '').toUpperCase() === 'TRAINING';
        if (isTrainingPayment && payment.memberId) {
            const paymentDate = new Date(payment.date);
            const windowStart = new Date(paymentDate.getTime() - 5 * 60 * 1000);
            const windowEnd = new Date(paymentDate.getTime() + 5 * 60 * 1000);
            const matched = await prisma.trainingSession.findMany({
                where: {
                    memberId: Number(payment.memberId),
                    paymentStatus: 'PAID',
                    paidAt: {
                        gte: windowStart,
                        lte: windowEnd
                    }
                },
                include: {
                    trainer: { select: { id: true, name: true } }
                },
                orderBy: { paidAt: 'asc' }
            });

            const amount = Number(payment.amount || 0);
            const sumMatched = matched.reduce((sum, session) => sum + Number(session.price || 0), 0);
            const hasExactSum = Math.abs(sumMatched - amount) < 0.01;
            if (hasExactSum) {
                trainingSessions = matched;
            } else {
                const singleExact = matched.find((session) => Math.abs(Number(session.price || 0) - amount) < 0.01);
                if (singleExact) {
                    trainingSessions = [singleExact];
                } else if (matched.length > 0) {
                    const nearest = [...matched].sort((a, b) => {
                        const aDiff = Math.abs(new Date(a.paidAt || a.date).getTime() - paymentDate.getTime());
                        const bDiff = Math.abs(new Date(b.paidAt || b.date).getTime() - paymentDate.getTime());
                        return aDiff - bDiff;
                    })[0];
                    trainingSessions = nearest ? [nearest] : [];
                }
            }
        }

        const collections = [{
            amount: Number(payment.payableAmount || payment.amount),
            financial_institution_id: payment.financialInstitutionId || 'N/A'
        }];

        res.json({
            ...payment,
            collections,
            trainingSessions
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// POS Payment Creation
const createPayment = async (req, res) => {
    const { amount, type, method, memberId, items, discount, cashTendered, changeDue, externalRef, externalDate, couponCode, currency } = req.body;
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

        const { PAYMENT_METHODS } = require('../../config/businessConfig');
        const allowedMethods = PAYMENT_METHODS.map(m => m.value);
        if (!allowedMethods.includes(method)) badRequest("Invalid payment method");

        const normalizedDiscount = discount !== undefined ? Number(discount) : 0;
        if (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0 || normalizedDiscount > 100) {
            badRequest("Invalid discount value");
        }

        const normalizedItems = Array.isArray(items)
            ? items.map((item) => ({
                ...item,
                type: item.type || 'PRODUCT',
                productId: Number(item.id || item.productId),
                quantity: Number(item.quantity)
            }))
            : [];

        const hasClassPackageItems = normalizedItems.some((item) => item.type === 'CLASS_PACKAGE');
        if (hasClassPackageItems) {
            if (!resolvedMemberId) badRequest("Member ID required for class package purchase");
            const member = await prisma.member.findUnique({
                where: { id: Number(resolvedMemberId) },
                select: { id: true, status: true, expiryDate: true }
            });
            if (!member) badRequest("Member not found");
            if (isMemberMembershipExpired(member)) {
                badRequest("Cannot add class sessions for expired membership. Renew membership first.");
            }
        }

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
                        select: { 
                            id: true, 
                            name: true, 
                            price: true,
                            stocks: { where: { gymId: req.user.gymId } }
                         }
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
                        const currentStock = product.stocks?.[0]?.quantity || 0;
                        if (item.quantity > currentStock) badRequest(`Insufficient stock for ${product.name} (Available: ${currentStock})`);
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

        // --- Multi-Tenancy: Fetch Gym Settings ---
        const gym = await prisma.gym.findUnique({
            where: { id: req.user.gymId },
            include: { tenant: true }
        });
        if (!gym) badRequest("Gym configuration not found");

        let effectiveDiscountPercent = normalizedDiscount;

        // --- Coupon / Promo Validation ---
        let appliedCoupon = null;
        let appliedPromo = null;
        let presetDiscountValue = Number((authoritativeAmount * (effectiveDiscountPercent / 100)).toFixed(2));
        let couponDiscountValue = 0;
        
        if (couponCode) {
            const codeUpper = couponCode.toUpperCase();
            appliedCoupon = await prisma.coupon.findFirst({ where: { code: codeUpper } });
            
            if (!appliedCoupon) {
                // Fallback to PromoCode
                appliedPromo = await prisma.promoCode.findFirst({ where: { code: codeUpper } });
                if (!appliedPromo) badRequest('Coupon / Promo code not found');
                
                if (!appliedPromo.isActive) badRequest('Promo code is inactive');
                if (appliedPromo.expiryDate && new Date(appliedPromo.expiryDate) < new Date()) badRequest('Promo code has expired');
                if (appliedPromo.maxUses && appliedPromo.usedCount >= appliedPromo.maxUses) badRequest('Promo code usage limit reached');
                
                // Calculate actual discount based on new scope/BOGO logic
                const { discountAmount } = calculateDiscount(appliedPromo, normalizedItems);
                couponDiscountValue = discountAmount;
                
            } else {
                // Validate loyalty coupon (Coupons are still legacy FLAT/PERCENTAGE on total)
                if (appliedCoupon.status !== 'ACTIVE') badRequest('Coupon is already used or expired');
                if (appliedCoupon.expiryDate && new Date(appliedCoupon.expiryDate) < new Date()) badRequest('Coupon has expired');

                // Member-lock check
                if (appliedCoupon.memberId && resolvedMemberId && Number(appliedCoupon.memberId) !== Number(resolvedMemberId)) {
                    badRequest('This coupon belongs to a different member and cannot be applied here.');
                }
                
                if (appliedCoupon.type === 'FLAT') {
                    couponDiscountValue = Math.min(appliedCoupon.value, authoritativeAmount - presetDiscountValue);
                } else if (appliedCoupon.type === 'PERCENTAGE') {
                    couponDiscountValue = (authoritativeAmount - presetDiscountValue) * (appliedCoupon.value / 100);
                }
            }
        }

        const discountValue = presetDiscountValue + couponDiscountValue;
        const discountedAmount = Number(Math.max(0, authoritativeAmount - discountValue).toFixed(2));

        // Invoice/Receipt specific calculations using Gym settings
        const taxRate = gym.taxRate || 12.0;
        const taxableAmount = Number((discountedAmount / (1 + (taxRate / 100))).toFixed(2));
        const taxAmount = Number((discountedAmount - taxableAmount).toFixed(2));
        
        // Rounding Logic
        let roundingAdjustment = 0;
        let finalPayableAmount = discountedAmount;
        if (gym.roundingRule === 'NEAREST_005') {
            finalPayableAmount = Math.round(discountedAmount * 20) / 20;
            roundingAdjustment = Number((finalPayableAmount - discountedAmount).toFixed(2));
        } else if (gym.roundingRule === 'NEAREST_01') {
            finalPayableAmount = Math.round(discountedAmount * 10) / 10;
            roundingAdjustment = Number((finalPayableAmount - discountedAmount).toFixed(2));
        } else if (gym.roundingRule === 'NEAREST_1') {
            finalPayableAmount = Math.round(discountedAmount);
            roundingAdjustment = Number((finalPayableAmount - discountedAmount).toFixed(2));
        }

        const referencePrefix = gym.referencePrefix || 'A321';
        const referenceId = `${referencePrefix}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        
        // Resolve Financial Institution ID from current gym settings
        const fi = await prisma.financialInstitution.findFirst({
            where: { method, isActive: true }
        });
        const financialInstitutionId = fi?.financialInstitutionId || 'EXTERNAL';

        const normalizedCashTendered = method === 'CASH'
            ? (cashTendered !== undefined && cashTendered !== null && cashTendered !== '' ? Number(cashTendered) : null)
            : null;
        if (method === 'CASH' && (!Number.isFinite(normalizedCashTendered) || normalizedCashTendered < finalPayableAmount)) {
            badRequest("Cash tendered is invalid or less than amount");
        }

        const normalizedChangeDue = method === 'CASH'
            ? (changeDue !== undefined && changeDue !== null && changeDue !== '' ? Number(changeDue) : (normalizedCashTendered - finalPayableAmount))
            : null;
        if (method === 'CASH' && !Number.isFinite(normalizedChangeDue)) badRequest("Invalid change due");

        let normalizedExternalDate = null;
        if (['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) && externalDate) {
            const parsedExternalDate = new Date(externalDate);
            if (Number.isNaN(parsedExternalDate.getTime())) badRequest("Invalid external payment date");
            normalizedExternalDate = parsedExternalDate;
        }

        const { LOYALTY_CONFIG } = require('../../config/businessConfig');
        const pointsAwarded = resolvedMemberId ? Math.floor(finalPayableAmount * LOYALTY_CONFIG.POINTS_PER_CURRENCY_UNIT) : 0;
        const resolvedCashierId = req.user.role === 'MEMBER' ? null : req.user.id;

        const payment = await prisma.$transaction(async (tx) => {
            const paymentCreateData = {
                amount: finalPayableAmount,
                payableAmount: finalPayableAmount,
                taxAmount,
                taxableAmount,
                roundingAdjustment,
                currency: gym.currency || 'PHP',
                referenceId,
                financialInstitutionId,
                companyId: gym.companyId || 'FITOS_GYM_001',
                type,
                method,
                memberId: resolvedMemberId ? Number(resolvedMemberId) : null,
                cashierId: resolvedCashierId ? Number(resolvedCashierId) : null,
                pointsAwarded,
                cashTendered: normalizedCashTendered,
                changeDue: normalizedChangeDue,
                externalRef: ['GCASH', 'PAYMAYA', 'CARD', 'BANK_TRANSFER'].includes(method) ? (externalRef || null) : null,
                externalDate: normalizedExternalDate,
                discount: normalizedDiscount,
                couponCode: appliedCoupon ? appliedCoupon.code : appliedPromo ? appliedPromo.code : null,
                couponDiscount: Number(couponDiscountValue.toFixed(2))
            };

            const removableOptionalFields = new Set(['discount', 'cashTendered', 'changeDue', 'externalRef', 'externalDate', 'payableAmount', 'taxAmount', 'taxableAmount', 'roundingAdjustment', 'currency', 'referenceId', 'companyId', 'financialInstitutionId']);
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
                            select: { 
                                id: true, 
                                name: true, 
                                price: true,
                                stocks: { where: { gymId: gym.id } }
                            }
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

                // Pre-checkout stock check
                for (const item of normalizedItems) {
                    if (item.type === 'PRODUCT') {
                        const product = productById.get(Number(item.productId));
                        if (!product) throw new Error(`Product ${item.productId} not found`);
                        const currentStock = product.stocks?.[0]?.quantity || 0;
                        if (item.quantity > currentStock) {
                            throw new Error(`Insufficient stock for product ${product.name} (Available: ${currentStock})`);
                        }
                    }
                }

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
                try {
                    const fs = require('fs');
                    fs.appendFileSync('server_debug.log', `[DEBUG] Final PaymentItems: ${JSON.stringify(paymentItems)}\n`);
                } catch (err) { }
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
                                freezeUsedCount: 0,
                                ...(getPlanClassSessions(plan) > 0
                                    ? { classSessionsRemaining: { increment: getPlanClassSessions(plan) } }
                                    : {})
                            }
                        });
                    } else if (item.type === 'PRODUCT' && item.productId) {
                        const updated = await tx.productStock.updateMany({
                            where: {
                                productId: item.productId,
                                gymId: req.user.gymId,
                                quantity: { gte: item.quantity }
                            },
                            data: { quantity: { decrement: item.quantity } }
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
                
                await tx.loyaltyTransaction.create({
                    data: {
                        memberId: Number(resolvedMemberId),
                        points: pointsAwarded,
                        type: 'EARNED',
                        description: `Points earned from purchase (Ref: ${referenceId || 'N/A'})`,
                        gymId: gym.id
                    }
                });
            }

            // Mark coupon as used or increment promo use count
            if (appliedCoupon) {
                await tx.coupon.update({
                    where: { id: appliedCoupon.id },
                    data: { status: 'USED' }
                });
            } else if (appliedPromo) {
                await tx.promoCode.update({
                    where: { id: appliedPromo.id },
                    data: { usedCount: { increment: 1 } }
                });
            }

            // Create PaymentCollection record for split payment support (even if single method)
            await tx.paymentCollection.create({
                data: {
                    paymentId: createdPayment.id,
                    amount: finalPayableAmount,
                    method,
                    financialInstitutionId
                }
            });


            return createdPayment;
        });

        // After successful payment, trigger notification/receipt
        if (payment && resolvedMemberId) {
            notificationService.sendReceipt({
                memberId: resolvedMemberId,
                amount: payment.amount,
                method: payment.method,
                items: normalizedItems,
                receiptId: payment.referenceId || `REC-${payment.id}`,
                referenceId: payment.referenceId,
                gymId: req.user.gymId
            }).catch(err => console.error('Failed to send receipt notification:', err));
        }

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

        const collections = [{
            amount: Number(payment.payableAmount || payment.amount),
            financial_institution_id: payment.financialInstitutionId
        }];

        res.json({
            ...payment,
            collections
        });
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
                    { type: 'STORE_SALE' },
                    { type: 'IN_APP_PURCHASE' },
                    { type: 'TRAINING' },
                    { status: 'PENDING' }
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
    if (startDate || endDate) {
        const date = {};
        if (startDate) {
            const parsedStart = new Date(startDate);
            if (Number.isNaN(parsedStart.getTime())) return res.status(400).json({ error: "Invalid startDate" });
            date.gte = parsedStart;
        }
        if (endDate) {
            const parsedEnd = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            if (Number.isNaN(parsedEnd.getTime())) return res.status(400).json({ error: "Invalid endDate" });
            date.lte = parsedEnd;
        }
        where.date = date;
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
        take: (startDate || endDate) ? undefined : 50,
        orderBy: { date: 'desc' },
        include: {
            member: true,
            cashier: { select: { id: true, name: true, role: true } }
        }
    });
    res.json(payments);
};

const getRefunds = async (req, res) => {
    try {
        const { startDate, endDate, page, limit, type } = req.query;
        const normalizedType = String(type || 'ALL').trim().toUpperCase();
        const allowedTypes = ['ALL', 'RETURNED', 'VOIDED'];
        if (!allowedTypes.includes(normalizedType)) {
            return res.status(400).json({ error: `type must be one of: ${allowedTypes.join(', ')}` });
        }
        const targetStatuses = normalizedType === 'ALL' ? ['VOIDED', 'RETURNED'] : [normalizedType];
        const where = {
            status: { in: targetStatuses }
        };

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

            const [refunds, total] = await Promise.all([
                prisma.payment.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: { date: 'desc' },
                    include: {
                        member: true,
                        cashier: { select: { id: true, name: true, role: true } },
                        items: true
                    }
                }),
                prisma.payment.count({ where })
            ]);

            return res.json({
                data: refunds,
                meta: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            });
        }

        const refunds = await prisma.payment.findMany({
            where,
            take: startDate ? undefined : 50,
            orderBy: { date: 'desc' },
            include: {
                member: true,
                cashier: { select: { id: true, name: true, role: true } },
                items: true
            }
        });
        res.json(refunds);
    } catch (e) {
        console.error('Fetch Refunds Error:', e);
        res.status(500).json({ error: 'Failed to fetch refunds' });
    }
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
            include: {
                items: true,
                cashier: { select: { id: true, role: true } }
            }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (payment.status !== 'COMPLETED' && payment.status !== 'RETURNED') {
            return res.status(400).json({ error: "Only completed payments can be returned" });
        }

        // --- Pre-transaction: compute what to return ---
        let refundAmount = 0;
        const validReturnItems = [];

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
            validReturnItems.push({ item, returnQty });
        }

        if (refundAmount <= 0 || validReturnItems.length === 0) {
            return res.status(400).json({ error: "Nothing to return" });
        }

        const trainerBuyerId = getTrainerBuyerIdFromPayment(payment);
        const pointsReversal = (payment.memberId || trainerBuyerId) ? Math.floor(refundAmount / 100) : 0;

        // --- Atomic transaction: all writes succeed or all roll back ---
        const updated = await prisma.$transaction(async (tx) => {
            // 1. Restore stock and mark items as returned
            for (const { item, returnQty } of validReturnItems) {
                await tx.paymentItem.update({
                    where: { id: item.id },
                    data: { returnedQuantity: { increment: returnQty } }
                });
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: returnQty } }
                });
            }

            // 2. Reverse loyalty points if applicable
            if (pointsReversal > 0) {
                if (payment.memberId) {
                    const member = await tx.member.findUnique({ where: { id: payment.memberId } });
                    if (member) {
                        await tx.member.update({
                            where: { id: payment.memberId },
                            data: { points: { decrement: pointsReversal } }
                        });
                    }
                } else if (trainerBuyerId) {
                    const trainerUser = await tx.user.findUnique({ where: { id: trainerBuyerId } });
                    if (trainerUser) {
                        await tx.user.update({
                            where: { id: trainerBuyerId },
                            data: { loyaltyPoints: { decrement: pointsReversal } }
                        });
                    }
                }
            }

            // 3. Update payment status (final step — only reached if all above succeed)
            return tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'RETURNED',
                    refundedAmount: { increment: refundAmount },
                    pointsReversed: { increment: pointsReversal }
                },
                include: { member: true, items: true }
            });
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
            include: {
                items: true,
                cashier: { select: { id: true, role: true } }
            }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (payment.status !== 'COMPLETED') {
            return res.status(400).json({ error: "Only completed payments can be voided" });
        }

        const trainerBuyerId = getTrainerBuyerIdFromPayment(payment);
        const pointsReversal = (payment.memberId || trainerBuyerId) ? (payment.pointsAwarded || 0) : 0;

        // --- Atomic transaction: all writes succeed or all roll back ---
        const updated = await prisma.$transaction(async (tx) => {
            // 1. Restore stock for every product item
            for (const item of payment.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } }
                    });
                }
            }

            // 2. Reverse loyalty points if applicable
            if (pointsReversal > 0) {
                if (payment.memberId) {
                    const member = await tx.member.findUnique({ where: { id: payment.memberId } });
                    if (member) {
                        await tx.member.update({
                            where: { id: payment.memberId },
                            data: { points: { decrement: pointsReversal } }
                        });
                    }
                } else if (trainerBuyerId) {
                    const trainerUser = await tx.user.findUnique({ where: { id: trainerBuyerId } });
                    if (trainerUser) {
                        await tx.user.update({
                            where: { id: trainerBuyerId },
                            data: { loyaltyPoints: { decrement: pointsReversal } }
                        });
                    }
                }
            }

            // 3. Mark payment as VOIDED (final step — only reached if all above succeed)
            return tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'VOIDED',
                    pointsReversed: { increment: pointsReversal }
                },
                include: { member: true, items: true }
            });
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to void payment" });
    }
};

const getPosSettings = async (req, res) => {
    try {
        const [config, receiptSettings] = await Promise.all([
            getPosConfig(),
            getReceiptSettings()
        ]);
        const discountPresets = await getStoredDiscountPresets(req.user.gymId);
        res.json({
            hasVoidPin: Boolean(config.voidPinHash),
            hasReturnPin: Boolean(config.returnPinHash),
            receiptSettings,
            discountPresets
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load POS settings" });
    }
};

const updatePosSettings = async (req, res) => {
    const { voidPin, returnPin, receiptSettings, discountPresets } = req.body;
    try {
        const body = req.body || {};
        const hasVoidPinInput = Object.prototype.hasOwnProperty.call(body, 'voidPin');
        const hasReturnPinInput = Object.prototype.hasOwnProperty.call(body, 'returnPin');
        const hasReceiptSettingsInput = Object.prototype.hasOwnProperty.call(body, 'receiptSettings');
        const hasDiscountPresetsInput = Object.prototype.hasOwnProperty.call(body, 'discountPresets');

        if (!hasVoidPinInput && !hasReturnPinInput && !hasReceiptSettingsInput && !hasDiscountPresetsInput) {
            const [config, currentReceiptSettings] = await Promise.all([
                getPosConfig(),
                getReceiptSettings()
            ]);
            return res.json({
                message: "No changes submitted",
                hasVoidPin: Boolean(config.voidPinHash),
                hasReturnPin: Boolean(config.returnPinHash),
                receiptSettings: currentReceiptSettings,
                discountPresets: await getStoredDiscountPresets(config.id)
            });
        }

        const data = {};
        let normalizedDiscountPresets = null;

        if (hasVoidPinInput) {
            if (voidPin === '' || voidPin === null) {
                data.voidPinHash = null;
            } else if (String(voidPin).length < POS_PIN_MIN_LENGTH) {
                return res.status(400).json({ error: `Void PIN must be at least ${POS_PIN_MIN_LENGTH} digits` });
            } else {
                data.voidPinHash = await bcrypt.hash(String(voidPin), 10);
            }
        }

        if (hasReturnPinInput) {
            if (returnPin === '' || returnPin === null) {
                data.returnPinHash = null;
            } else if (String(returnPin).length < POS_PIN_MIN_LENGTH) {
                return res.status(400).json({ error: `Return PIN must be at least ${POS_PIN_MIN_LENGTH} digits` });
            } else {
                data.returnPinHash = await bcrypt.hash(String(returnPin), 10);
            }
        }

        if (hasDiscountPresetsInput) {
            try {
                normalizedDiscountPresets = normalizeDiscountPresets(discountPresets);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }
        }

        const config = await getPosConfig();

        if (Object.keys(data).length > 0) {
            await prisma.posConfig.update({
                where: { id: config.id },
                data
            });
        }

        if (hasDiscountPresetsInput) {
            await saveDiscountPresets(req.user.gymId, normalizedDiscountPresets);
        }

        let savedReceiptSettings = null;
        if (hasReceiptSettingsInput) {
            savedReceiptSettings = await saveReceiptSettings(receiptSettings || {});
        }

        res.json({
            message: "POS settings updated",
            receiptSettings: savedReceiptSettings,
            discountPresets: hasDiscountPresetsInput ? normalizedDiscountPresets : undefined
        });
    } catch (e) {
        console.error("updatePosSettings Error:", e);
        res.status(500).json({ error: "Failed to update POS settings" });
    }
};

const getPosReceiptSettings = async (req, res) => {
    try {
        const settings = await getReceiptSettings();
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: "Failed to load receipt settings" });
    }
};

const getPosDiscountOptions = async (req, res) => {
    try {
        const discountPresets = await getStoredDiscountPresets(req.user.gymId);
        res.json(discountPresets);
    } catch (e) {
        res.status(500).json({ error: "Failed to load discount presets" });
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

const collectPendingCashPayment = async (req, res) => {
    const paymentId = Number(req.params.id);
    const cashTendered = Number(req.body?.cashTendered);

    if (!Number.isInteger(paymentId)) {
        return res.status(400).json({ error: "Invalid payment ID" });
    }
    if (!Number.isFinite(cashTendered) || cashTendered < 0) {
        return res.status(400).json({ error: "Invalid cash tendered amount" });
    }

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                member: true,
                cashier: { select: { id: true, role: true } }
            }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (payment.status !== 'PENDING') {
            return res.status(400).json({ error: "Only pending payments can be collected" });
        }
        if (String(payment.method || '').toUpperCase() !== 'CASH') {
            return res.status(400).json({ error: "Only pending cash payments can be collected from this flow" });
        }
        if (cashTendered < Number(payment.amount || 0)) {
            return res.status(400).json({ error: "Cash tendered must be at least the payment amount" });
        }

        const trainerBuyerId = getTrainerBuyerIdFromPayment(payment);
        const pointsAwarded = (payment.memberId || trainerBuyerId) ? Math.floor(Number(payment.amount || 0) / 100) : 0;
        const changeDue = Number((cashTendered - Number(payment.amount || 0)).toFixed(2));

        const updated = await prisma.$transaction(async (tx) => {
            const paymentItems = await tx.paymentItem.findMany({
                where: { paymentId },
                select: { id: true, productId: true, quantity: true, name: true }
            });

            for (const item of paymentItems) {
                if (!item.productId) continue;
                const decremented = await tx.product.updateMany({
                    where: {
                        id: Number(item.productId),
                        stock: { gte: Number(item.quantity) }
                    },
                    data: { stock: { decrement: Number(item.quantity) } }
                });
                if (decremented.count === 0) {
                    throw new Error(`Insufficient stock for ${item.name || 'product'}`);
                }
            }

            const completedPayment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'COMPLETED',
                    cashTendered,
                    changeDue,
                    pointsAwarded,
                    cashierId: trainerBuyerId ? payment.cashierId : req.user.id
                },
                include: {
                    member: true,
                    cashier: { select: { id: true, name: true, role: true } },
                    items: true
                }
            });

            if (payment.memberId && pointsAwarded > 0) {
                await tx.member.update({
                    where: { id: Number(payment.memberId) },
                    data: { points: { increment: pointsAwarded } }
                });
            }
            if (!payment.memberId && trainerBuyerId && pointsAwarded > 0) {
                await tx.user.update({
                    where: { id: Number(trainerBuyerId) },
                    data: { loyaltyPoints: { increment: pointsAwarded } }
                });
            }

            return completedPayment;
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to collect pending cash payment", detail: e.message });
    }
};

const declinePendingCashPayment = async (req, res) => {
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId)) {
        return res.status(400).json({ error: "Invalid payment ID" });
    }

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { member: true }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (payment.status !== 'PENDING') {
            return res.status(400).json({ error: "Only pending payments can be declined" });
        }
        if (String(payment.method || '').toUpperCase() !== 'CASH') {
            return res.status(400).json({ error: "Only pending cash payments can be declined from this flow" });
        }

        const declined = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'VOIDED',
                cashierId: req.user.id
            },
            include: {
                member: true,
                cashier: { select: { id: true, name: true, role: true } },
                items: true
            }
        });

        res.json(declined);
    } catch (e) {
        res.status(500).json({ error: "Failed to decline pending cash payment", detail: e.message });
    }
};


const completePayment = async (req, res) => {
    const { id } = req.params;
    const { cashTendered } = req.body;

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: Number(id) },
            include: { items: true, member: true, cashier: true }
        });

        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (payment.status === 'COMPLETED') return res.status(400).json({ error: "Payment already completed" });

        const changeDue = Number(cashTendered) - (payment.payableAmount || payment.amount);
        if (changeDue < 0) return res.status(400).json({ error: "Insufficient cash tendered" });

        const updated = await prisma.$transaction(async (tx) => {
            // 1. Deduct stock for each product in the payment
            for (const item of payment.items) {
                if (item.productId && item.type === 'PRODUCT') {
                    const decremented = await tx.product.updateMany({
                        where: {
                            id: item.productId,
                            stock: { gte: item.quantity }
                        },
                        data: { stock: { decrement: item.quantity } }
                    });
                    if (decremented.count === 0) {
                        throw new Error(`Insufficient stock for ${item.name || 'product'}`);
                    }
                }
            }

            // 2. Mark payment as COMPLETED
            return tx.payment.update({
                where: { id: Number(id) },
                data: {
                    status: 'COMPLETED',
                    cashTendered: Number(cashTendered),
                    changeDue,
                    cashierId: req.user.id
                },
                include: { member: true, items: true, cashier: { select: { id: true, name: true, role: true } } }
            });
        });

        res.json(updated);
    } catch (e) {
        console.error('Complete Payment Error:', e);
        res.status(500).json({ error: "Failed to complete payment" });
    }
};

const exportInvoices = async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        const gym = await prisma.gym.findUnique({
            where: { id: req.user.gymId }
        });

        if (!gym) {
            return res.status(404).json({ error: "Gym context not found" });
        }

        const where = {
            status: 'COMPLETED'
        };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        }

        const payments = await prisma.payment.findMany({
            where,
            include: {
                items: true,
                collections: true
            },
            orderBy: { date: 'asc' }
        });

        const exportData = {
            company_id: gym.companyId,
            branch_id: gym.id.toString(),
            branch_name: gym.name,
            invoices: payments.map(p => ({
                reference_id: p.referenceId,
                date: p.date.toISOString(),
                total_amount: Number(p.amount),
                payable_amount: Number(p.payableAmount || p.amount),
                taxable_amount: Number(p.taxableAmount || 0),
                tax_amount: Number(p.taxAmount || 0),
                rounding_adjustment: Number(p.roundingAdjustment || 0),
                currency: p.currency || 'PHP',
                status: 'PAID',
                items: p.items.map(i => ({
                    name: i.name,
                    quantity: i.quantity,
                    unit_price: Number(i.unitPrice),
                    total: Number(i.quantity * i.unitPrice)
                })),
                collections: p.collections.map(c => ({
                    amount: Number(c.amount),
                    method: c.method,
                    financial_institution_id: c.financialInstitutionId
                }))
            }))
        };

        res.json(exportData);
    } catch (e) {
        console.error('Invoice Export Error:', e);
        res.status(500).json({ error: "Failed to export invoices" });
    }
};

module.exports = {
    getPaymentDetails,
    createPayment,
    getAllPayments,
    returnPaymentItems,
    voidPayment,
    completePayment,
    getPosSettings,
    getPosReceiptSettings,
    getPosDiscountOptions,
    updatePosSettings,
    getMyTransactions,
    collectPendingCashPayment,
    declinePendingCashPayment,
    getRefunds,
    exportInvoices
};
