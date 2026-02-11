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

        // 1. Period Financials
        const periodRevenueAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: queryStart, lte: queryEnd } }
        });
        const periodExpensesAgg = await prisma.expense.aggregate({
            _sum: { amount: true },
            where: { date: { gte: queryStart, lte: queryEnd } }
        });

        const periodRevenue = periodRevenueAgg._sum.amount || 0;
        const periodExpenses = periodExpensesAgg._sum.amount || 0;

        // 2. Revenue Trend (Daily for the selected period)
        const revenueTrendRaw = await prisma.payment.findMany({
            where: { date: { gte: queryStart, lte: queryEnd } },
            select: { date: true, amount: true }
        });

        const trendMap = {};
        const dailyRevenue = {}; // For weekly distribution Mon-Sun
        revenueTrendRaw.forEach(item => {
            const dayStr = item.date.toISOString().split('T')[0];
            trendMap[dayStr] = (trendMap[dayStr] || 0) + item.amount;

            const weekday = item.date.toLocaleDateString('en-US', { weekday: 'short' });
            dailyRevenue[weekday] = (dailyRevenue[weekday] || 0) + item.amount;
        });

        const weeklyRevenue = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => dailyRevenue[day] || 0);

        const revenueTrend = Object.keys(trendMap).map(date => ({
            date,
            amount: trendMap[date]
        }));

        // Calculate Net Profit (Month to Date)
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthlyRevenue = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: firstDayOfMonth } }
        });
        const monthlyExpenses = await prisma.expense.aggregate({
            _sum: { amount: true },
            where: { date: { gte: firstDayOfMonth } }
        });

        const totalRev = monthlyRevenue._sum.amount || 0;
        const totalExp = monthlyExpenses._sum.amount || 0;

        const expiring = await prisma.member.count({
            where: {
                expiryDate: {
                    lte: new Date(new Date().setDate(new Date().getDate() + 7)),
                    gte: new Date()
                }
            }
        });

        // Calculate Membership Distribution (by Plan)
        const activeMembersList = await prisma.member.findMany({
            where: { status: 'ACTIVE' },
            select: { plan: { select: { name: true } } }
        });
        const distMap = {};
        activeMembersList.forEach(m => {
            const pName = m.plan?.name || 'Unknown';
            distMap[pName] = (distMap[pName] || 0) + 1;
        });
        const membershipDistribution = Object.keys(distMap).map(key => ({
            label: key,
            count: distMap[key]
        }));

        // 3. Legacy/Dashboard Specific Stats (for AdminDashboard.jsx)
        const todayRevenueAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: startOfToday } }
        });

        // Detailed Revenue Breakdown
        const storeRevenueAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: queryStart, lte: queryEnd }, type: 'STORE_SALE' }
        });
        const posRevenueAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: queryStart, lte: queryEnd }, type: 'POS_SALE' }
        });
        const trainingRevenueAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: queryStart, lte: queryEnd }, type: { in: ['TRAINING', 'SERVICE'] } }
        });
        const trainingExpensesAgg = await prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
                date: { gte: queryStart, lte: queryEnd },
                OR: [
                    { title: { startsWith: 'Commission:' } },
                    { title: { startsWith: 'Session Material' } }
                ]
            }
        });
        const membershipRevenueAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: queryStart, lte: queryEnd }, type: 'MEMBERSHIP' }
        });

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

        res.json({
            activeMembers: totalMembers,
            revenueToday: todayRevenueAgg._sum.amount || 0,
            expiringSoon: expiring,
            monthlyRevenue: totalRev,
            totalExpenses: totalExp,
            periodRevenue,
            periodExpenses,
            netProfit: periodRevenue - periodExpenses,
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
            recentActivity: await getRecentActivity()
        });
    } catch (e) {
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
        orderBy: { joinDate: 'desc' },
        select: { firstName: true, lastName: true, joinDate: true }
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
            time: m.joinDate
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
