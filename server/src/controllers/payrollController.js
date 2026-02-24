const prisma = require('../config/prisma');

const executeCommissionPayout = async (tx, { trainerId, sessionIds = [], classHistoryIds = [], recordedBy }) => {
    let totalCommission = 0;
    const notes = [];

    const trainer = await tx.trainer.findUnique({
        where: { id: Number(trainerId) },
        include: { user: { select: { id: true } } }
    });
    if (!trainer) {
        const err = new Error('Trainer not found');
        err.status = 404;
        throw err;
    }

    const sessions = sessionIds.length
        ? await tx.trainingSession.findMany({
            where: {
                id: { in: sessionIds.map(Number) },
                trainerId: Number(trainerId),
                status: 'COMPLETED',
                commissionPaid: false
            },
            include: { trainer: true, member: true }
        })
        : [];
    sessions.forEach((session) => {
        const comm = session.price * (session.trainer?.commissionRate || 0);
        totalCommission += comm;
        const memberName = session.member
            ? `${session.member.firstName} ${session.member.lastName || ''}`.trim()
            : `Session #${session.id}`;
        const rate = ((session.trainer?.commissionRate || 0) * 100).toFixed(0);
        notes.push(`${memberName} (PHP ${session.price} x ${rate}% = PHP ${comm.toFixed(2)})`);
    });

    const classes = classHistoryIds.length
        ? await tx.classHistory.findMany({
            where: {
                id: { in: classHistoryIds.map(Number) },
                trainerId: Number(trainerId),
                commissionPaid: false
            },
            include: { class: true }
        })
        : [];
    classes.forEach((cls) => {
        totalCommission += cls.commissionAmount;
        const className = cls.class?.name || `Class #${cls.classId}`;
        notes.push(`${className} (${cls.attendeeCount} students = PHP ${cls.commissionAmount.toFixed(2)})`);
    });

    if (totalCommission <= 0) {
        const err = new Error('Total commission amount is zero.');
        err.status = 400;
        throw err;
    }

    const materialDeductionItems = trainer.user?.id
        ? await tx.paymentItem.findMany({
            where: {
                intendedForSessionMaterial: true,
                payment: {
                    cashierId: Number(trainer.user.id),
                    method: 'COMMISSION_DEDUCTION'
                }
            },
            orderBy: [{ payment: { date: 'asc' } }, { id: 'asc' }]
        })
        : [];

    const outstandingMaterialDeduction = materialDeductionItems.reduce((sum, item) => {
        const unsettledQty = Math.max(
            0,
            Number(item.quantity || 0) - Number(item.returnedQuantity || 0) - Number(item.materialSettledQuantity || 0)
        );
        return sum + (unsettledQty * Number(item.unitPrice || 0));
    }, 0);

    const netPayout = Number((totalCommission - outstandingMaterialDeduction).toFixed(2));
    if (netPayout < 0) {
        const err = new Error(`Selected commissions (${totalCommission.toFixed(2)}) are lower than outstanding material deductions (${outstandingMaterialDeduction.toFixed(2)}).`);
        err.status = 400;
        throw err;
    }

    if (sessions.length > 0) {
        await tx.trainingSession.updateMany({
            where: { id: { in: sessions.map((s) => s.id) } },
            data: { commissionPaid: true }
        });
    }
    if (classes.length > 0) {
        await tx.classHistory.updateMany({
            where: { id: { in: classes.map((c) => c.id) } },
            data: { commissionPaid: true }
        });
    }

    for (const item of materialDeductionItems) {
        const unsettledQty = Math.max(
            0,
            Number(item.quantity || 0) - Number(item.returnedQuantity || 0) - Number(item.materialSettledQuantity || 0)
        );
        if (unsettledQty <= 0) continue;
        await tx.paymentItem.update({
            where: { id: item.id },
            data: { materialSettledQuantity: { increment: unsettledQty } }
        });
    }

    await tx.expense.create({
        data: {
            title: `Commission Payout: ${trainer.name}`,
            amount: netPayout,
            category: 'SALARY',
            date: new Date(),
            notes: `${notes.join('; ')}${outstandingMaterialDeduction > 0 ? `; Material Deduction: -${outstandingMaterialDeduction.toFixed(2)}` : ''}`,
            recordedBy: String(recordedBy),
            trainerId: Number(trainerId)
        }
    });

    return {
        grossAmount: totalCommission,
        materialDeduction: outstandingMaterialDeduction,
        amount: netPayout
    };
};

const getStats = async (req, res) => { console.log('GET STATS REQ.QUERY:', req.query);
    try {
        const { startDate, endDate } = req.query;
        let start = null;
        let end = null;

        if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        const expenses = await prisma.expense.findMany({
            where: {
                category: 'SALARY',
                date: {
                    gte: start,
                    lte: end
                }
            }
        });

        const totalPayroll = expenses.reduce((sum, e) => sum + e.amount, 0);

        const pendingSessions = await prisma.trainingSession.findMany({
            where: {
                status: 'COMPLETED',
                commissionPaid: false,
                date: { gte: start, lte: end }
            },
            include: { trainer: true }
        });

        let pendingCommissions = 0;
        pendingSessions.forEach((session) => {
            const commission = session.price * (session.trainer?.commissionRate || 0);
            pendingCommissions += commission;
        });

        const pendingMaterialItems = await prisma.paymentItem.findMany({
            where: {
                intendedForSessionMaterial: true,
                payment: {
                    method: 'COMMISSION_DEDUCTION',
                    date: { gte: start, lte: end }
                }
            },
            select: {
                quantity: true,
                returnedQuantity: true,
                unitPrice: true,
                materialSettledQuantity: true
            }
        });

        const pendingMaterialDeductions = pendingMaterialItems.reduce((sum, item) => {
            const qty = Math.max(
                0,
                Number(item.quantity || 0) - Number(item.returnedQuantity || 0) - Number(item.materialSettledQuantity || 0)
            );
            return sum + (qty * Number(item.unitPrice || 0));
        }, 0);

        res.json({
            totalPayrollThisMonth: totalPayroll,
            pendingCommissions,
            pendingMaterialDeductions
        });
    } catch (e) {
        console.error('Get Payroll Stats Error:', e);
        res.status(500).json({ error: 'Failed to fetch payroll stats' });
    }
};

const getTrainers = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let expenseFilter = { category: 'SALARY' };
        let dateFilter = {};

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            expenseFilter.date = { gte: start, lte: end };
            dateFilter = { gte: start, lte: end };
        }

        const trainers = await prisma.trainer.findMany({
            include: {
                user: { select: { id: true } },
                expenses: {
                    where: expenseFilter
                },
                trainingSessions: {
                    where: {
                        status: 'COMPLETED',
                        commissionPaid: false,
                        ...(dateFilter.gte ? { date: dateFilter } : {})
                    },
                    include: { member: { select: { firstName: true, lastName: true } } }
                },
                classHistory: {
                    where: {
                        commissionPaid: false,
                        ...(dateFilter.gte ? { date: dateFilter } : {})
                    },
                    include: { class: true }
                }
            }
        });

        const data = [];
        for (const t of trainers) {
            const unpaidSessionCommissions = t.trainingSessions.reduce((sum, s) => sum + (s.price * (t.commissionRate || 0)), 0);
            const unpaidClassCommissions = t.classHistory.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
            const totalPaid = t.expenses.reduce((sum, e) => sum + e.amount, 0);

            let outstandingMaterialDeductions = 0;
            let materialDeductionItems = [];

            if (t.user?.id) {
                const deductionItems = await prisma.paymentItem.findMany({
                    where: {
                        intendedForSessionMaterial: true,
                        payment: {
                            cashierId: Number(t.user.id),
                            method: 'COMMISSION_DEDUCTION',
                            ...(dateFilter.gte ? { date: dateFilter } : {})
                        }
                    },
                    include: {
                        payment: { select: { id: true, date: true } }
                    },
                    orderBy: [{ payment: { date: 'asc' } }, { id: 'asc' }]
                });

                materialDeductionItems = deductionItems
                    .map((item) => {
                        const unsettledQty = Math.max(
                            0,
                            Number(item.quantity || 0) - Number(item.returnedQuantity || 0) - Number(item.materialSettledQuantity || 0)
                        );
                        const total = unsettledQty * Number(item.unitPrice || 0);
                        return {
                            paymentItemId: item.id,
                            paymentId: item.paymentId,
                            name: item.name,
                            unitPrice: Number(item.unitPrice || 0),
                            unsettledQty,
                            unsettledTotal: total,
                            purchasedAt: item.payment?.date || null
                        };
                    })
                    .filter((item) => item.unsettledQty > 0);

                outstandingMaterialDeductions = materialDeductionItems.reduce((sum, item) => sum + item.unsettledTotal, 0);
            }

            data.push({
                id: t.id,
                name: t.name,
                type: t.type,
                imageUrl: t.imageUrl,
                baseSalary: t.baseSalary,
                commissionRate: t.commissionRate,
                unpaidCommissions: unpaidSessionCommissions + unpaidClassCommissions,
                outstandingMaterialDeductions,
                netPayableCommissions: Math.max(0, (unpaidSessionCommissions + unpaidClassCommissions) - outstandingMaterialDeductions),
                totalPaid,
                unpaidSessions: t.trainingSessions,
                classHistory: t.classHistory,
                materialDeductionItems
            });
        }

        res.json(data);
    } catch (e) {
        console.error('Get Trainers Payroll Error:', e);
        res.status(500).json({ error: 'Failed to fetch trainer payroll' });
    }
};

const getStaff = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let expenseFilter = { category: 'SALARY' };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            expenseFilter.date = { gte: start, lte: end };
        }

        const staff = await prisma.user.findMany({
            where: {
                role: { in: ['STAFF', 'ADMIN', 'OWNER'] }
            },
            include: {
                expenses: {
                    where: expenseFilter
                }
            }
        });

        const data = staff.map((u) => {
            const totalPaid = u.expenses.reduce((sum, e) => sum + e.amount, 0);
            return {
                id: u.id,
                name: u.name || u.email,
                role: u.role,
                baseSalary: u.baseSalary,
                totalPaid
            };
        });

        res.json(data);
    } catch (e) {
        console.error('Get Staff Payroll Error:', e);
        res.status(500).json({ error: 'Failed to fetch staff payroll' });
    }
};

const payCommissions = async (req, res) => {
    const { trainerId, sessionIds, classHistoryIds } = req.body;

    if (!trainerId || (!sessionIds?.length && !classHistoryIds?.length)) {
        return res.status(400).json({ error: 'Invalid request data. Select sessions or classes to pay.' });
    }

    try {
        const result = await prisma.$transaction((tx) => executeCommissionPayout(tx, {
            trainerId: Number(trainerId),
            sessionIds: sessionIds.map(Number),
            classHistoryIds: classHistoryIds.map(Number),
            recordedBy: req.user.id
        }));

        res.json({
            message: 'Commissions paid successfully',
            ...result
        });
    } catch (e) {
        console.error('Pay Commissions Error:', e);
        res.status(e?.status || 500).json({ error: e?.message || 'Failed to process commission payment' });
    }
};

const payCommissionsAuto = async (req, res) => {
    const trainerId = Number(req.body?.trainerId);
    if (!Number.isInteger(trainerId) || trainerId <= 0) {
        return res.status(400).json({ error: 'trainerId is required' });
    }

    try {
        const [sessions, classes] = await Promise.all([
            prisma.trainingSession.findMany({
                where: { trainerId, status: 'COMPLETED', commissionPaid: false },
                select: { id: true }
            }),
            prisma.classHistory.findMany({
                where: { trainerId, commissionPaid: false },
                select: { id: true }
            })
        ]);

        if (!sessions.length && !classes.length) {
            return res.status(400).json({ error: 'No unpaid commissions found for this trainer.' });
        }

        const result = await prisma.$transaction((tx) => executeCommissionPayout(tx, {
            trainerId,
            sessionIds: sessions.map((s) => Number(s.id)),
            classHistoryIds: classes.map((c) => Number(c.id)),
            recordedBy: req.user.id
        }));

        res.json({
            message: 'Commissions paid (auto) successfully',
            ...result
        });
    } catch (e) {
        console.error('Auto Pay Commissions Error:', e);
        res.status(e?.status || 500).json({ error: e?.message || 'Failed to auto pay commissions' });
    }
};

module.exports = {
    getStats,
    getTrainers,
    getStaff,
    payCommissions,
    payCommissionsAuto
};
