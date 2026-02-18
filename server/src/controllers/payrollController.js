const prisma = require('../config/prisma');

const getStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Calculate total payroll for current month
        const expenses = await prisma.expense.findMany({
            where: {
                category: 'SALARY',
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        });

        const totalPayroll = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Pending Commissions (Detailed breakdown below)
        const pendingSessions = await prisma.trainingSession.findMany({
            where: {
                status: 'COMPLETED',
                commissionPaid: false
            },
            include: { trainer: true }
        });

        let pendingCommissions = 0;
        pendingSessions.forEach(session => {
            const commission = session.price * (session.trainer?.commissionRate || 0);
            pendingCommissions += commission;
        });

        res.json({
            totalPayrollThisMonth: totalPayroll,
            pendingCommissions: pendingCommissions
        });

    } catch (e) {
        console.error("Get Payroll Stats Error:", e);
        res.status(500).json({ error: "Failed to fetch payroll stats" });
    }
};

const getTrainers = async (req, res) => {
    try {
        const trainers = await prisma.trainer.findMany({
            include: {
                expenses: {
                    where: { category: 'SALARY' }
                },
                trainingSessions: {
                    where: { status: 'COMPLETED', commissionPaid: false }
                },
                classHistory: {
                    where: { commissionPaid: false },
                    include: { class: true }
                }
            }
        });

        const data = trainers.map(t => {
            const unpaidSessionCommissions = t.trainingSessions.reduce((sum, s) => {
                return sum + (s.price * (t.commissionRate || 0));
            }, 0);

            const unpaidClassCommissions = t.classHistory.reduce((sum, c) => {
                return sum + (c.commissionAmount || 0);
            }, 0);

            const totalPaid = t.expenses.reduce((sum, e) => sum + e.amount, 0);

            return {
                id: t.id,
                name: t.name,
                imageUrl: t.imageUrl,
                baseSalary: t.baseSalary,
                commissionRate: t.commissionRate,
                unpaidCommissions: unpaidSessionCommissions + unpaidClassCommissions,
                totalPaid,
                unpaidSessions: t.trainingSessions, // Return unpaid session details for aggregated payment
                classHistory: t.classHistory // Return unpaid class history for aggregated payment
            };
        });

        res.json(data);
    } catch (e) {
        console.error("Get Trainers Payroll Error:", e);
        res.status(500).json({ error: "Failed to fetch trainer payroll" });
    }
};

const getStaff = async (req, res) => {
    try {
        const staff = await prisma.user.findMany({
            where: {
                role: { in: ['STAFF', 'ADMIN', 'OWNER'] }
            },
            include: {
                expenses: {
                    where: { category: 'SALARY' }
                }
            }
        });

        const data = staff.map(u => {
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
        console.error("Get Staff Payroll Error:", e);
        res.status(500).json({ error: "Failed to fetch staff payroll" });
    }
};

const payCommissions = async (req, res) => {
    const { trainerId, sessionIds, classHistoryIds } = req.body;

    // Validate that at least one array has IDs
    if (!trainerId || (!sessionIds?.length && !classHistoryIds?.length)) {
        return res.status(400).json({ error: "Invalid request data. Select sessions or classes to pay." });
    }

    try {
        let totalCommission = 0;
        let notes = [];

        // 1. Process Sessions
        if (sessionIds && sessionIds.length > 0) {
            const sessions = await prisma.trainingSession.findMany({
                where: {
                    id: { in: sessionIds.map(Number) },
                    trainerId: Number(trainerId),
                    status: 'COMPLETED',
                    commissionPaid: false
                },
                include: { trainer: true }
            });

            sessions.forEach(session => {
                totalCommission += session.price * (session.trainer?.commissionRate || 0);
            });

            if (sessions.length > 0) {
                notes.push(`${sessions.length} Sessions (IDs: ${sessionIds.join(', ')})`);
                await prisma.trainingSession.updateMany({
                    where: { id: { in: sessionIds.map(Number) } },
                    data: { commissionPaid: true }
                });
            }
        }

        // 2. Process Classes
        if (classHistoryIds && classHistoryIds.length > 0) {
            const classes = await prisma.classHistory.findMany({
                where: {
                    id: { in: classHistoryIds.map(Number) },
                    trainerId: Number(trainerId),
                    commissionPaid: false
                }
            });

            classes.forEach(cls => {
                totalCommission += cls.commissionAmount;
            });

            if (classes.length > 0) {
                notes.push(`${classes.length} Classes (IDs: ${classHistoryIds.join(', ')})`);
                await prisma.classHistory.updateMany({
                    where: { id: { in: classHistoryIds.map(Number) } },
                    data: { commissionPaid: true }
                });
            }
        }

        if (totalCommission <= 0) {
            return res.status(400).json({ error: "Total commission amount is zero." });
        }

        // 3. Create Expense Record
        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        await prisma.expense.create({
            data: {
                title: `Commission Payout: ${trainer.name}`,
                amount: totalCommission,
                category: 'SALARY',
                date: new Date(),
                notes: `Aggregated Commission. ${notes.join('. ')}`,
                recordedBy: req.user.id.toString(),
                trainerId: Number(trainerId)
            }
        });

        res.json({ message: "Commissions paid successfully", amount: totalCommission });

    } catch (e) {
        console.error("Pay Commissions Error:", e);
        res.status(500).json({ error: "Failed to process commission payment" });
    }
};

module.exports = {
    getStats,
    getTrainers,
    getStaff,
    payCommissions
};
