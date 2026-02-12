const prisma = require('../config/prisma');

const getHealthStats = async (req, res) => {
    try {
        const expenseSum = await prisma.expense.aggregate({ _sum: { amount: true } });
        const expenseCount = await prisma.expense.count();
        res.json({
            message: "Direct DB Check",
            totalAmount: expenseSum._sum.amount,
            count: expenseCount,
            dbUrl: process.env.DATABASE_URL
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        // If Member, return only their own stats (or simplified generic stats)
        if (req.user.role === 'MEMBER') {
            const now = new Date();
            const member = await prisma.member.findUnique({
                where: { id: req.user.id },
                include: {
                    plan: true,
                    accessLogs: {
                        where: { status: 'ALLOWED' },
                        select: { id: true, checkIn: true },
                        orderBy: { checkIn: 'desc' }
                    },
                    membershipPeriods: {
                        include: { plan: true },
                        orderBy: { endDate: 'desc' }
                    }
                }
            });
            if (!member) return res.status(404).json({ error: "Member not found" });

            const activePeriod = member?.membershipPeriods?.find((period) => new Date(period.endDate) >= now) || null;
            const currentPlanName = activePeriod?.plan?.name || member?.plan?.name || 'No Active Plan';
            const checkIns = member?.accessLogs?.length || 0;
            const loyaltyPoints = member?.points || 0;

            return res.json({
                activeMembers: 0, // Not relevant for member
                revenueToday: 0, // Not relevant
                expiringSoon: member.expiryDate, // Show their expiry
                memberData: member,
                currentPlanName,
                checkIns,
                loyaltyPoints
            });
        }
        if (req.user.role === 'TRAINER') {
            const trainerId = req.user.trainerId;
            if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
            const upcomingSessions = await prisma.trainingSession.count({
                where: { trainerId: Number(trainerId), date: { gte: new Date() } }
            });
            const totalClasses = await prisma.class.count({ where: { trainerId: Number(trainerId) } });
            return res.json({
                upcomingSessions,
                totalClasses
            });
        }

        // ADMIN/STAFF stats
        const today = new Date();
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);

        const totalMembers = await prisma.member.count({ where: { status: 'ACTIVE' } });

        // Date Logic - Dynamic Range
        console.log("Stats Query Params:", req.query);
        const queryStart = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const queryEnd = req.query.endDate ? new Date(new Date(req.query.endDate).setHours(23, 59, 59, 999)) : new Date();
        console.log("Parsed Range:", queryStart, queryEnd);

        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // 1. Parallelize Period Financials, Trend, Net Profit basics, Expiring, Distribution, and Legacy Stats
        // 1. Parallelize Period Financials, Trend, Net Profit basics, Expiring, Distribution, and Legacy Stats
        const [
            periodRevenueAgg,
            periodExpensesAgg,
            revenueTrendRaw,
            monthlyRevenue,
            monthlyExpenses,
            expiring,
            activeMembersList,
            todayRevenueAgg,
            storeRevenueAgg,
            posRevenueAgg,
            trainingRevenueAgg,
            trainingExpensesAgg,
            membershipRevenueAgg,
            recentActivity,
            sixMonthPayments,
            sixMonthExpenses,
            expenseByCategory,
            expensesTodayAgg,
            transactionsTodayCount,
            lowStockCount,
            lowStockItems,
            pendingPaymentRecords,
            unpaidSessionsCount
        ] = await Promise.all([
            // 1. Period Financials
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: queryStart, lte: queryEnd } }
            }),
            prisma.expense.aggregate({
                _sum: { amount: true },
                where: { date: { gte: queryStart, lte: queryEnd } }
            }),
            // 2. Revenue Trend
            prisma.payment.findMany({
                where: { date: { gte: queryStart, lte: queryEnd } },
                select: { date: true, amount: true }
            }),
            // Net Profit (This Month)
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: firstDayOfMonth } }
            }),
            prisma.expense.aggregate({
                _sum: { amount: true },
                where: { date: { gte: firstDayOfMonth } }
            }),
            // Expiring
            prisma.member.count({
                where: {
                    expiryDate: {
                        lte: new Date(new Date().setDate(new Date().getDate() + 7)),
                        gte: new Date()
                    }
                }
            }),
            // Membership Distribution
            prisma.member.findMany({
                where: { status: 'ACTIVE' },
                select: { plan: { select: { name: true } } }
            }),
            // Legacy / Dashboard Specific
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: startOfToday } }
            }),
            // Breakdowns
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: queryStart, lte: queryEnd }, type: 'STORE_SALE' }
            }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: queryStart, lte: queryEnd }, type: 'POS_SALE' }
            }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: queryStart, lte: queryEnd }, type: { in: ['TRAINING', 'SERVICE'] } }
            }),
            prisma.expense.aggregate({
                _sum: { amount: true },
                where: {
                    date: { gte: queryStart, lte: queryEnd },
                    OR: [
                        { title: { startsWith: 'Commission:' } },
                        { title: { startsWith: 'Session Material' } }
                    ]
                }
            }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: queryStart, lte: queryEnd }, type: 'MEMBERSHIP' }
            }),
            getRecentActivity(),
            // 6-Month History
            prisma.payment.groupBy({
                by: ['date'],
                _sum: { amount: true },
                where: { date: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } }
            }),
            prisma.expense.groupBy({
                by: ['date'],
                _sum: { amount: true },
                where: { date: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } }
            }),
            // Expense Breakdown by Category
            prisma.expense.groupBy({
                by: ['category'],
                _sum: { amount: true },
                where: { date: { gte: queryStart, lte: queryEnd } }
            }),
            // Expenses Today
            prisma.expense.aggregate({
                _sum: { amount: true },
                where: { date: { gte: startOfToday } }
            }),
            // 19. Transactions Today
            prisma.payment.count({
                where: { date: { gte: startOfToday } }
            }),
            // 20. Low Stock Items (Threshold <= 10)
            prisma.product.count({
                where: { stock: { lte: 10 } }
            }),
            prisma.product.findMany({
                where: { stock: { lte: 10 } },
                orderBy: { stock: 'asc' },
                take: 3,
                select: { name: true, stock: true }
            }),
            // 21. Pending Payments
            // 21. Pending Payments
            prisma.payment.count({
                where: { status: 'PENDING' }
            }),
            // 22. Unpaid Training Sessions
            prisma.trainingSession.count({
                where: { paymentStatus: 'UNPAID' }
            })
        ]);

        const pendingPaymentsCount = pendingPaymentRecords + unpaidSessionsCount;

        const periodRevenue = periodRevenueAgg._sum.amount || 0;
        const periodExpenses = periodExpensesAgg._sum.amount || 0;

        const trendMap = {};
        const dailyRevenue = {}; // Restore dailyRevenue for weekly distribution
        // trendMap structure: { "YYYY-MM-DD": { revenue: 0, expense: 0 } }

        revenueTrendRaw.forEach(item => {
            const dayStr = item.date.toISOString().split('T')[0];
            if (!trendMap[dayStr]) trendMap[dayStr] = { revenue: 0, expense: 0 };
            trendMap[dayStr].revenue += item.amount;

            // Restore Weekly Distribution Logic
            const weekday = item.date.toLocaleDateString('en-US', { weekday: 'short' });
            dailyRevenue[weekday] = (dailyRevenue[weekday] || 0) + item.amount;
        });

        // Restore Weekly Revenue Array
        const weeklyRevenue = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => dailyRevenue[day] || 0);

        // Merge Expenses into Trend
        const expensesTrendRaw = await prisma.expense.findMany({
            where: { date: { gte: queryStart, lte: queryEnd } },
            select: { date: true, amount: true }
        });

        expensesTrendRaw.forEach(item => {
            const dayStr = item.date.toISOString().split('T')[0];
            if (!trendMap[dayStr]) trendMap[dayStr] = { revenue: 0, expense: 0 };
            trendMap[dayStr].expense += item.amount;
        });

        const revenueTrend = Object.keys(trendMap).sort().map(date => ({
            date,
            revenue: trendMap[date].revenue,
            expense: trendMap[date].expense,
            net: trendMap[date].revenue - trendMap[date].expense
        }));

        const totalRev = monthlyRevenue._sum.amount || 0;
        const totalExp = monthlyExpenses._sum.amount || 0;
        const netProfit = totalRev - totalExp;
        const profitMargin = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : 0;

        const distMap = {};
        activeMembersList.forEach(m => {
            const pName = m.plan?.name || 'Unknown';
            distMap[pName] = (distMap[pName] || 0) + 1;
        });
        const membershipDistribution = Object.keys(distMap).map(key => ({
            label: key,
            count: distMap[key]
        }));

        const storeRevenue = storeRevenueAgg._sum.amount || 0;
        const posRevenue = posRevenueAgg._sum.amount || 0;
        const shopRevenue = storeRevenue + posRevenue;
        const trainingRevenue = trainingRevenueAgg._sum.amount || 0;
        const membershipRevenue = membershipRevenueAgg._sum.amount || 0;
        const trainingExpenses = trainingExpensesAgg._sum.amount || 0;
        const trainingNet = trainingRevenue - trainingExpenses;

        const revenueDistribution = [
            { label: 'Membership', value: membershipRevenue, color: '#FF8C00' },
            { label: 'Training', value: trainingRevenue, color: '#10B981' },
            { label: 'Store (App)', value: storeRevenue, color: '#3B82F6' },
            { label: 'POS (Counter)', value: posRevenue, color: '#8B5CF6' }
        ];

        // Process 6-Month P&L
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const pnlMap = {};

        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            pnlMap[key] = { month: key, revenue: 0, expense: 0 };
        }

        sixMonthPayments.forEach(p => {
            const key = `${monthNames[new Date(p.date).getMonth()]} ${new Date(p.date).getFullYear()}`;
            if (pnlMap[key]) pnlMap[key].revenue += p._sum.amount || 0;
        });

        sixMonthExpenses.forEach(e => {
            const key = `${monthNames[new Date(e.date).getMonth()]} ${new Date(e.date).getFullYear()}`;
            if (pnlMap[key]) pnlMap[key].expense += e._sum.amount || 0;
        });

        const profitLossHistory = Object.values(pnlMap);

        // Process Expense Breakdown
        const expenseBreakdown = expenseByCategory.map(e => ({
            category: e.category,
            amount: e._sum.amount || 0
        })).sort((a, b) => b.amount - a.amount);

        res.json({
            activeMembers: totalMembers,
            revenueToday: todayRevenueAgg._sum.amount || 0,
            expensesToday: expensesTodayAgg._sum.amount || 0,
            netProfitToday: (todayRevenueAgg._sum.amount || 0) - (expensesTodayAgg._sum.amount || 0),
            expiringSoon: expiring,
            monthlyRevenue: totalRev,
            totalExpenses: totalExp,
            periodRevenue,
            periodExpenses,
            netProfit: periodRevenue - periodExpenses,
            profitMargin,
            revenueTrend,
            weeklyRevenue,
            membershipDistribution,
            revenueDistribution,
            breakdown: {
                shopRevenue,
                storeRevenue,
                posRevenue,
                trainingRevenue,
                trainingExpenses,
                trainingNet
            },
            recentActivity,
            profitLossHistory,
            expenseBreakdown,
            transactionsToday: transactionsTodayCount,
            lowStockCount,
            lowStockItems, // Top 3 items
            pendingPaymentsCount
        });
    } catch (e) {
        console.error("Dashboard Stats Error:", e);
        res.status(500).json({ error: e.message });
    }
};

const getRecentActivity = async () => {
    // Fetch last 5 payments with member info
    const payments = await prisma.payment.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: { member: { select: { firstName: true, lastName: true } } }
    });

    // Fetch last 5 new members
    const newMembers = await prisma.member.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { firstName: true, lastName: true, createdAt: true }
    });

    // Combine and sort
    const activities = [
        ...payments.map(p => ({
            type: 'PAYMENT',
            user: p.member ? `${p.member.firstName} ${p.member.lastName}` : 'Guest',
            action: p.type === 'MEMBERSHIP' ? 'renewed membership' : `paid for ${p.type.toLowerCase().replace('_', ' ')}`,
            time: p.date
        })),
        ...newMembers.map(m => ({
            type: 'MEMBER',
            user: `${m.firstName} ${m.lastName}`,
            action: 'joined the gym',
            time: m.createdAt
        }))
    ]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 5);

    return activities;
};

module.exports = {
    getHealthStats,
    getDashboardStats
};
