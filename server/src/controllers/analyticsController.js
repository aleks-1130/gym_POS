const prisma = require('../config/prisma');

const getAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const payments = await prisma.payment.findMany({
            where: {
                date: { gte: start, lte: end }
            },
            include: {
                member: true,
                cashier: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                items: { include: { product: true } }
            },
            orderBy: { date: 'desc' }
        });

        const expenses = await prisma.expense.findMany({
            where: { date: { gte: start, lte: end } }
        });

        const trainingSessions = await prisma.trainingSession.findMany({
            where: { date: { gte: start, lte: end } },
            select: {
                id: true,
                date: true,
                price: true,
                materialsCost: true,
                member: true,
                trainer: true
            }
        });

        const accessLogs = await prisma.accessLog.findMany({
            where: { checkIn: { gte: start, lte: end } }
        });

        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalRevenue - totalExpenses;

        const shopSales = payments
            .filter(p => p.type === 'POS_SALE' || p.type === 'STORE_SALE')
            .reduce((sum, p) => sum + p.amount, 0);

        const trainingRevenue = trainingSessions.reduce((sum, s) => sum + (s.price || 0), 0);
        const trainingCosts = trainingSessions.reduce((sum, s) => sum + (s.materialsCost || 0), 0);
        const trainingEarnings = trainingRevenue - trainingCosts;

        const membershipRevenue = payments.filter(p => p.type === 'MEMBERSHIP').reduce((sum, p) => sum + p.amount, 0);
        const posRevenue = payments.filter(p => p.type === 'POS_SALE').reduce((sum, p) => sum + p.amount, 0);
        const storeRevenue = payments.filter(p => p.type === 'STORE_SALE').reduce((sum, p) => sum + p.amount, 0);

        const dailyRevenue = {};
        payments.forEach(p => {
            const day = new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' });
            dailyRevenue[day] = (dailyRevenue[day] || 0) + p.amount;
        });
        const revenueTrends = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => dailyRevenue[day] || 0);

        const hourlyActivity = new Array(24).fill(0);
        accessLogs.forEach(log => {
            const hour = new Date(log.checkIn).getHours();
            hourlyActivity[hour]++;
        });
        const peakHours = [
            hourlyActivity.slice(6, 9).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(9, 12).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(12, 15).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(15, 18).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(18, 21).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(21, 24).reduce((a, b) => a + b, 0)
        ];

        const productSales = {};
        payments.forEach(payment => {
            payment.items.forEach(item => {
                if (item.product) {
                    if (!productSales[item.product.id]) {
                        productSales[item.product.id] = {
                            ...item.product,
                            totalSales: 0,
                            quantity: 0
                        };
                    }
                    productSales[item.product.id].totalSales += item.unitPrice * item.quantity;
                    productSales[item.product.id].quantity += item.quantity;
                }
            });
        });

        const topProducts = Object.values(productSales)
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 10);

        const members = await prisma.member.findMany({ include: { plan: true } });
        const membershipDist = {};
        members.forEach(m => {
            if (m.plan) {
                membershipDist[m.plan.name] = (membershipDist[m.plan.name] || 0) + 1;
            }
        });

        const transactions = payments.map(p => ({
            id: p.id,
            date: p.date,
            type: p.type,
            member: p.member ? `${p.member.firstName} ${p.member.lastName}` : 'Guest',
            staff: p.cashier ? p.cashier.name : 'Unknown',
            method: p.method,
            amount: p.amount
        }));

        res.json({
            summary: {
                revenue: totalRevenue,
                expenses: totalExpenses,
                netProfit: netProfit,
                shopSales: shopSales,
                trainingEarnings: trainingEarnings,
                transactionCount: payments.length
            },
            revenueBySource: {
                membership: membershipRevenue,
                training: trainingRevenue,
                store: storeRevenue,
                pos: posRevenue
            },
            revenueTrends,
            peakHours,
            topProducts,
            membershipDistribution: membershipDist,
            transactions,
            dateRange: { start, end }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
};

module.exports = {
    getAnalytics
};
