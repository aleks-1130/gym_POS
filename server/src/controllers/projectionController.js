const prisma = require('../config/prisma');

const getSnapshot = async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // Active members (have a non-expired membership)
        const activeMembers = await prisma.member.count({
            where: {
                expiryDate: { gte: now }
            }
        });

        // Membership revenue last 30 days
        const membershipPayments = await prisma.payment.aggregate({
            where: {
                date: { gte: thirtyDaysAgo },
                status: 'COMPLETED',
                type: { in: ['MEMBERSHIP', 'PLAN', 'PACKAGE'] }
            },
            _sum: { amount: true }
        });
        const membershipRevenueLast30d = membershipPayments._sum.amount || 0;

        // Avg revenue per member
        const avgRevenuePerMember = activeMembers > 0
            ? Math.round(membershipRevenueLast30d / activeMembers)
            : 0;

        // Product sales last 30 days (POS sales only)
        const productPayments = await prisma.payment.aggregate({
            where: {
                date: { gte: thirtyDaysAgo },
                status: 'COMPLETED',
                type: 'POS'
            },
            _sum: { amount: true }
        });
        const productRevenueLast30d = productPayments._sum.amount || 0;

        // Trainer commissions last 30 days (paid salaries with category=SALARY) 
        const trainerExpenses = await prisma.expense.aggregate({
            where: {
                date: { gte: thirtyDaysAgo },
                category: 'SALARY'
            },
            _sum: { amount: true }
        });
        const trainerCommissionsLast30d = trainerExpenses._sum.amount || 0;

        // Fixed / overhead expenses last 30 days (non-salary, non-inventory)
        const fixedExpenses = await prisma.expense.aggregate({
            where: {
                date: { gte: thirtyDaysAgo },
                category: { notIn: ['SALARY', 'INVENTORY', 'SESSION_MATERIAL'] }
            },
            _sum: { amount: true }
        });
        const fixedExpensesLast30d = fixedExpenses._sum.amount || 0;

        // Inventory / COGS last 30 days
        const inventoryExpenses = await prisma.expense.aggregate({
            where: {
                date: { gte: thirtyDaysAgo },
                category: { in: ['INVENTORY', 'SESSION_MATERIAL'] }
            },
            _sum: { amount: true }
        });
        const inventoryCostLast30d = inventoryExpenses._sum.amount || 0;

        res.json({
            activeMembers,
            avgRevenuePerMember,
            membershipRevenueLast30d,
            productRevenueLast30d,
            trainerCommissionsLast30d,
            fixedExpensesLast30d,
            inventoryCostLast30d
        });
    } catch (e) {
        console.error('Projection Snapshot Error:', e);
        res.status(500).json({ error: 'Failed to load projection snapshot' });
    }
};

module.exports = { getSnapshot };
