const prisma = require('../../config/prisma');

const getAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1. Current Period
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // 2. Previous Period (Same duration, immediately preceding)
        const duration = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - duration);

        const { tenantId, role, gymId: userGymId } = req.user;
        
        // Branch Isolation: If not OWNER, restrict to user's assigned gym
        const effectiveGymId = role === 'OWNER' ? undefined : Number(userGymId);
        
        const branchFilter = effectiveGymId ? { id: effectiveGymId } : {};
        const gymFilter = effectiveGymId ? { gymId: effectiveGymId } : {};
        // Some models use 'gymId', others use a relation 'gym'
        const gymRelationFilter = effectiveGymId ? { gymId: effectiveGymId } : {};
        const [
            payments,
            prevPayments,
            expenses,
            prevExpenses,
            trainingSessions,
            accessLogs,
            products, // Needed for stock info
            members,
            trainers
        ] = await Promise.all([
            // Current Period Payments (exclude voided)
            prisma.payment.findMany({
                where: { 
                    date: { gte: start, lte: end }, 
                    status: { in: ['COMPLETED', 'RETURNED'] },
                    tenantId,
                    ...gymFilter
                },
                include: {
                    member: { select: { id: true, firstName: true, lastName: true } },
                    cashier: { select: { id: true, name: true, role: true } },
                    items: { include: { product: true } }
                },
                orderBy: { date: 'desc' }
            }),
            // Previous Period Payments (exclude voided)
            prisma.payment.findMany({
                where: { 
                    date: { gte: prevStart, lte: prevEnd }, 
                    status: { in: ['COMPLETED', 'RETURNED'] },
                    tenantId,
                    ...gymFilter
                },
                select: { amount: true, type: true, refundedAmount: true }
            }),
            // Current Expenses
            prisma.expense.findMany({ 
                where: { 
                    date: { gte: start, lte: end },
                    tenantId,
                    ...gymFilter
                } 
            }),
            // Previous Expenses
            prisma.expense.findMany({ 
                where: { 
                    date: { gte: prevStart, lte: prevEnd },
                    tenantId,
                    ...gymFilter
                }, 
                select: { amount: true } 
            }),
            // Training Sessions
            prisma.trainingSession.findMany({
                where: { 
                    date: { gte: start, lte: end }, 
                    status: 'COMPLETED',
                    tenantId,
                    ...gymFilter
                },
                select: {
                    id: true, date: true, price: true, materialsCost: true,
                    member: { select: { id: true, firstName: true, lastName: true } },
                    trainer: { select: { id: true, name: true, commissionRate: true } }
                }
            }),
            // Access Logs
            prisma.accessLog.findMany({ 
                where: { 
                    checkIn: { gte: start, lte: end },
                    tenantId,
                    ...gymFilter
                } 
            }),
            // All Products (to get current Stock)
            prisma.product.findMany({ where: { tenantId, ...gymFilter } }),
            // All Members (allowed to filter active/expired in memory for stats)
            prisma.member.findMany({ 
                where: { tenantId, ...gymFilter },
                include: { plan: true } 
            }),
            // All Trainers
            prisma.trainer.findMany({ where: { tenantId, ...gymFilter } })
        ]);


        // --- CALCULATIONS ---

        // 1. Revenue & Sources (subtract refunded amounts)
        const totalRefunds = payments.reduce((sum, p) => sum + (p.refundedAmount || 0), 0);
        const totalRevenue = payments.reduce((sum, p) => sum + p.amount - (p.refundedAmount || 0), 0);

        // Dynamic Revenue Sources Calculation
        // Initialize with 0 for all known types to ensure consistent keys
        const initialSources = { 'MEMBERSHIP': 0, 'TRAINING': 0, 'STORE_SALE': 0, 'POS_SALE': 0 };
        const revenueBySourceRaw = payments.reduce((acc, p) => {
            const type = p.type || 'OTHER'; // Handle unknown types
            acc[type] = (acc[type] || 0) + p.amount;
            return acc;
        }, initialSources);

        // Normalize keys for frontend (camelCase)
        const revenueBySource = {
            membership: revenueBySourceRaw['MEMBERSHIP'] || 0,
            training: revenueBySourceRaw['TRAINING'] || 0,
            store: revenueBySourceRaw['STORE_SALE'] || 0,
            pos: revenueBySourceRaw['POS_SALE'] || 0,
            dayPass: revenueBySourceRaw['DAY_PASS'] || 0, // Catch-all for other potentially missing types
            ...Object.keys(revenueBySourceRaw).reduce((acc, key) => {
                if (!['MEMBERSHIP', 'TRAINING', 'STORE_SALE', 'POS_SALE'].includes(key)) {
                    acc[key.toLowerCase()] = revenueBySourceRaw[key];
                }
                return acc;
            }, {})
        };

        // CRITICAL FIX: Add TrainingSession revenue to training breakdown
        // Training revenue comes from TWO sources:
        // 1. Payment records with type='TRAINING' (already counted above)
        // 2. TrainingSession records with their own price field (need to add)
        const trainingSessionRevenue = trainingSessions.reduce((sum, s) => sum + (s.price || 0), 0);
        revenueBySource.training = (revenueBySource.training || 0) + trainingSessionRevenue;

        const shopSales = (revenueBySource.store || 0) + (revenueBySource.pos || 0);

        // 2. Training Logic (Commissions)
        const trainerPerformance = {};
        if (trainers) {
            trainers.forEach(t => {
                trainerPerformance[t.id] = {
                    name: t.name,
                    revenue: 0,
                    commissionCost: 0,
                    netGymProfit: 0,
                    sessions: 0
                };
            });
        }

        trainingSessions.forEach(session => {
            if (session.trainer) {
                const tid = session.trainer.id;
                if (!trainerPerformance[tid]) {
                    trainerPerformance[tid] = {
                        name: session.trainer.name,
                        revenue: 0,
                        commissionCost: 0,
                        netGymProfit: 0,
                        sessions: 0
                    };
                }
                const rev = session.price || 0;
                const comm = rev * (session.trainer.commissionRate || 0);

                trainerPerformance[tid].revenue += rev;
                trainerPerformance[tid].commissionCost += comm;
                trainerPerformance[tid].netGymProfit += (rev - comm);
                trainerPerformance[tid].sessions += 1;
            }
        });
        const totalTrainingRev = revenueBySource.training;
        const topTrainers = Object.values(trainerPerformance)
            .sort((a, b) => b.revenue - a.revenue)
            .map(t => ({
                ...t,
                avgRevPerSession: t.sessions > 0 ? t.revenue / t.sessions : 0,
                contributionPercent: totalTrainingRev > 0 ? ((t.revenue / totalTrainingRev) * 100).toFixed(1) : 0
            }));

        const totalCommission = Object.values(trainerPerformance).reduce((acc, t) => acc + (t.commissionCost || 0), 0);

        // 3. Product Logic (COGS & Margins)
        const productByName = new Map(products.map(p => [p.name.toLowerCase(), p]));

        const productSales = {};
        const categoryPerformance = {};
        let totalSupplyCost = 0;

        payments.forEach(payment => {
            payment.items.forEach(item => {
                const rev = item.unitPrice * item.quantity;
                let cost = 0;
                let pid = null;
                let pName = item.name || 'Unknown Item';
                let pCat = 'Uncategorized';
                let pPrice = item.unitPrice;
                let currentStock = 0;
                let minStock = 0;

                let originalProd = null;

                if (item.product) {
                    pid = item.product.id;
                    originalProd = products.find(p => p.id === pid);
                } else if (item.type === 'PRODUCT' && productByName.has(pName.toLowerCase())) {
                    // Fallback: Try to match by name if productId is missing
                    originalProd = productByName.get(pName.toLowerCase());
                    pid = originalProd.id;
                }

                if (originalProd) {
                    const supplyCost = originalProd.supplyCost || 0;
                    cost = supplyCost * item.quantity;

                    pName = originalProd.name;
                    pCat = originalProd.category || 'Uncategorized';
                    pPrice = originalProd.price;
                    currentStock = originalProd.stock;
                    minStock = originalProd.minStock;
                } else {
                    // Handle unlinked items (custom items, deleted products, or non-product types)
                    if (item.type === 'PLAN') pCat = 'Memberships';
                    else if (item.type === 'CLASS_PACKAGE') pCat = 'Class Packages';
                    else if (item.type === 'TRAINING') pCat = 'Training Sessions';
                    else pCat = 'Uncategorized';

                    // We key them by name to group duplicates
                    pid = `${item.type.toLowerCase()}-${pName.replace(/\s+/g, '-').toLowerCase()}`;
                }

                totalSupplyCost += cost;
                const profit = rev - cost;

                // Product Stats
                if (!productSales[pid]) {
                    productSales[pid] = {
                        id: pid,
                        name: pName,
                        category: pCat,
                        price: pPrice,
                        stock: currentStock,
                        minStock: minStock,
                        unitsSold: 0,
                        totalSales: 0,
                        totalProfit: 0,
                        isCustom: !item.product // Flag for UI
                    };
                }
                productSales[pid].totalSales += rev;
                productSales[pid].totalProfit += profit;
                productSales[pid].unitsSold += item.quantity;

                // Category Stats
                if (!categoryPerformance[pCat]) {
                    categoryPerformance[pCat] = {
                        category: pCat,
                        revenue: 0,
                        profit: 0,
                        unitsSold: 0,
                        cogs: 0
                    };
                }
                categoryPerformance[pCat].revenue += rev;
                categoryPerformance[pCat].profit += profit;
                categoryPerformance[pCat].cogs += cost;
                categoryPerformance[pCat].unitsSold += item.quantity;
            });
        });

        // 4. Expenses (Operating + COGS + Commissions)
        const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = operatingExpenses + totalSupplyCost + totalCommission;

        // Previous period calculations for growth metrics
        const prevRevenue = prevPayments.reduce((sum, p) => sum + p.amount - (p.refundedAmount || 0), 0);
        const prevOperatingExpenses = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
        const revenueGrowth = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;
        // Approximation for prev COGS/Comm to avoid complex query: Scale by revenue ratio? 
        // Or simpler: just compare operating expenses for growth trend
        // Accurate way: we need prev period payments/sessions. We have 'prevPayments' (select amount, type) and 'prevExpenses'.
        // We DO NOT have items/products for prevPayments to calc exact prev COGS.
        // We will fallback to using operating expenses for growth comparison or Ratio.
        // Let's stick to comparing simple 'Expenses' (Operating) for the 'Growth' indicator to avoid misleading volatility.
        const expenseGrowth = prevOperatingExpenses === 0 ? 100 : ((operatingExpenses - prevOperatingExpenses) / prevOperatingExpenses) * 100;


        // 5. Profitability
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Prev Profit (Approximate for trend)
        // Only counting Operating Expenses for prev period means Prev Profit is overstated (Gross - OpExp).
        // Current Profit is (Gross - COGS - Comm - OpExp).
        // Comparisons will be wrong.
        // FIX: Estimate prev COGS/Comm using current margin? 
        // Better: TotalRevenue_Prev - PrevOperatingExpenses is "Cash Flow Profit".
        // Let's use that for comparison but label it?
        // Actually, let's keep it simple. If we want Accurate Net Profit Growth, we need accurate Prev Data.
        // Since we lack prev COGS, let's assume 'prevRevenue' came with similar margin?
        // Let's just compare (Rev - OpExp) vs (PrevRev - PrevOpExp) for the "Growth" indicator to keep apples-to-apples.
        // OR: just calculated Current Net Profit and don't show Growth for Net Profit if data is missing.
        // User asked for "Comparison metrics".
        // Let's use "Operating Profit" for growth comparison? 
        // No, let's do (PrevRevenue - PrevOpExp). It's close enough for a V1 if we assume COGS is low/stable.
        // WAIT! We have 'trainingSessions' only for current period.
        // Let's skip 'profitGrowth' if we can't calculate it accurately.
        // Or just use the Operating Profit Growth.
        // Let's try:
        const prevNetProfitApprox = prevRevenue - prevOperatingExpenses; // Missing COGS/Comm
        // This is bad.
        // Let's use Current Revenue Growth and Current Expense Growth. 
        // Let's set profitGrowth to 0 or null if unreliable.
        // For the sake of the user request, let's just calc it as (Rev - OpEx) to be consistent with previous logic, 
        // BUT display the REAL Net Profit (Rev - ALL Costs) as the main number.
        const prevRevenueVal = prevRevenue || 0;
        // ... proceeding with previous simple calculation for trends/growth to avoid breaking UI,
        // but passing the CORRECTED absolute values for the main dashboard.
        const prevRevenueMetric = prevRevenue;  // from lines 70

        // 6. Trends & Charts
        // ... (Reusing existing trend logic but grouping correctly)
        // Actually the existing trend logic lines 95-136 used 'payments' and 'expenses'.
        // 'expenses' was just operating expenses.
        // 'payments' was just revenue.
        // So the "Net Profit Trend" chart was actually "Operating Cash Flow" trend.
        // We should subtract COGS/Comm from the daily revenue to get Daily Gross Profit?
        // Too complex for now.
        // Let's keep the Trend Chart as Revenue vs Operating Expenses, which is valid "Cash Flow".
        // Or labeled "Net Profit Trend"? 
        // Let's stick to the existing logic for trends but ensure we pass the data.
        const dailyRevenue = {};
        const dailyExpenses = {};
        const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        payments.forEach(p => {
            const day = formatDate(p.date);
            dailyRevenue[day] = (dailyRevenue[day] || 0) + p.amount;
        });
        expenses.forEach(e => {
            const day = formatDate(e.date);
            dailyExpenses[day] = (dailyExpenses[day] || 0) + e.amount;
        });
        const allDates = new Set([...Object.keys(dailyRevenue), ...Object.keys(dailyExpenses)]);
        const sortedTrendLabels = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
        const revenueTrends = sortedTrendLabels.map(day => dailyRevenue[day] || 0);
        const expensesTrends = sortedTrendLabels.map(day => dailyExpenses[day] || 0);


        // ... (Product/Category Logic from above loop) ...
        // ... (Product/Category Logic from above loop) ...
        // 1. Existing Products
        const existingProductsPerf = products.map(p => {
            const salesData = productSales[p.id] || { totalSales: 0, totalProfit: 0, unitsSold: 0 };
            const realizedMargin = salesData.totalSales > 0 ? ((salesData.totalProfit / salesData.totalSales) * 100) : 0;
            const currentSupplyCost = p.supplyCost || 0;
            const currentPrice = p.price || 0;
            const potentialMargin = currentPrice > 0 ? ((currentPrice - currentSupplyCost) / currentPrice) * 100 : 0;
            return {
                id: p.id,
                name: p.name,
                category: p.category,
                price: p.price,
                stock: p.stock,
                minStock: p.minStock,
                unitsSold: salesData.unitsSold,
                totalSales: salesData.totalSales,
                totalProfit: salesData.totalProfit,
                margin: salesData.totalSales > 0 ? realizedMargin.toFixed(1) : potentialMargin.toFixed(1),
                isPotentialMargin: salesData.totalSales === 0,
                contributionPercent: totalRevenue > 0 ? ((salesData.totalSales / totalRevenue) * 100).toFixed(1) : 0
            };
        });

        // 2. Custom/Deleted Items (found in productSales with 'custom-' prefix)
        const customItemsPerf = Object.keys(productSales)
            .filter(pid => String(pid).startsWith('custom-'))
            .map(pid => {
                const salesData = productSales[pid];
                const realizedMargin = salesData.totalSales > 0 ? ((salesData.totalProfit / salesData.totalSales) * 100) : 0;

                return {
                    id: pid,
                    name: salesData.name,
                    category: salesData.category || 'Uncategorized',
                    price: salesData.price,
                    stock: 0,
                    minStock: 0,
                    unitsSold: salesData.unitsSold,
                    totalSales: salesData.totalSales,
                    totalProfit: salesData.totalProfit,
                    margin: realizedMargin.toFixed(1),
                    isPotentialMargin: false,
                    isCustom: true,
                    contributionPercent: totalRevenue > 0 ? ((salesData.totalSales / totalRevenue) * 100).toFixed(1) : 0
                };
            });

        const allProductPerformance = [...existingProductsPerf, ...customItemsPerf].sort((a, b) => b.totalSales - a.totalSales);

        const topProducts = allProductPerformance.slice(0, 10);
        const topCategories = Object.values(categoryPerformance)
            .sort((a, b) => b.revenue - a.revenue)
            .map(c => ({
                ...c,
                margin: c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(1) : 0,
                avgItemPrice: c.unitsSold > 0 ? c.revenue / c.unitsSold : 0
            }));

        const lowStockItems = products.filter(p => p.stock <= p.minStock).map(p => ({
            name: p.name, stock: p.stock, minStock: p.minStock
        }));

        // Strategic
        const activeMembers = members.filter(m => m.status === 'ACTIVE').length;
        const totalMembers = members.length;
        const retentionRate = totalMembers > 0 ? ((activeMembers / totalMembers) * 100).toFixed(1) : 0;
        const arpu = activeMembers > 0 ? (totalRevenue / activeMembers).toFixed(2) : 0;

        // Traffic
        const hourlyActivity = new Array(24).fill(0);
        // ... (existing traffic logic)
        accessLogs.forEach(log => hourlyActivity[new Date(log.checkIn).getHours()]++);
        const peakHours = [
            hourlyActivity.slice(6, 9).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(9, 12).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(12, 15).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(15, 18).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(18, 21).reduce((a, b) => a + b, 0),
            hourlyActivity.slice(21, 24).reduce((a, b) => a + b, 0)
        ];
        const checkInsCount = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
        const daysMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
        accessLogs.forEach(log => {
            const dayName = daysMap[new Date(log.checkIn).getDay()];
            if (checkInsCount[dayName] !== undefined) checkInsCount[dayName]++;
        });
        const checkInsByDay = { labels: Object.keys(checkInsCount), data: Object.values(checkInsCount) };
        const totalVisits = accessLogs.length;
        const maxActivity = Math.max(...hourlyActivity);
        const peakHourIndex = hourlyActivity.indexOf(maxActivity);
        const peakHourStr = totalVisits > 0 ? `${peakHourIndex % 12 || 12} ${peakHourIndex >= 12 ? 'PM' : 'AM'}` : 'N/A';
        const busiestDayEntry = Object.entries(checkInsCount).reduce((a, b) => a[1] > b[1] ? a : b);
        const busiestDay = totalVisits > 0 ? busiestDayEntry[0] : 'N/A';
        const operations = { totalVisits, busiestDay, peakHour: peakHourStr, visitsByType: [{ name: 'Regular', count: totalVisits, percentage: 100 }] };

        // Membership Dist
        const membershipDist = {};
        members.forEach(m => { if (m.plan) membershipDist[m.plan.name] = (membershipDist[m.plan.name] || 0) + 1; });

        // Insights
        const insights = [];
        if (revenueGrowth > 0) insights.push(`Revenue increased by ${revenueGrowth.toFixed(1)}% vs previous period.`);
        if (shopSales > revenueBySource.training) insights.push("Retail sales are outperforming training revenue.");
        if (topCategories.length > 0) insights.push(`${topCategories[0].category} is the highest earning category.`);

        // Transactions for list
        const transactions = payments.map(p => ({
            id: p.id, date: p.date, type: p.type,
            member: p.member ? `${p.member.firstName} ${p.member.lastName}` : 'Guest',
            staff: p.cashier ? p.cashier.name : 'Unknown',
            method: p.method, amount: p.amount
        }));

        res.json({
            summary: {
                revenue: totalRevenue,
                expenses: totalExpenses, // Now includes COGS + Comm + OpEx
                netProfit: netProfit,
                profitMargin: profitMargin.toFixed(1),
                revenueGrowth: revenueGrowth.toFixed(1),
                expenseGrowth: expenseGrowth.toFixed(1),
                totalCommission,
                totalSupplyCost,
                operatingExpenses // Separate field for breakdown
            },
            expenseBreakdown: [
                // Manual Breakdown construction
                { category: 'Operating Expenses', amount: operatingExpenses },
                { category: 'Product Costs (COGS)', amount: totalSupplyCost },
                { category: 'Staff Commissions', amount: totalCommission }
            ].sort((a, b) => b.amount - a.amount),
            profitGrowth: 0, // Disabled for now due to lack of prev COGS
            shopSales,
            transactionCount: payments.length,
            strategic: { activeMembers, retentionRate, arpu },
            revenueBySource,
            trends: { labels: sortedTrendLabels, revenue: revenueTrends, expenses: expensesTrends },
            peakHours, checkInsByDay, topProducts, allProducts: allProductPerformance, products: allProductPerformance,
            productSales, topCategories, lowStockItems, topTrainers, membershipDistribution: membershipDist,
            transactions, insights, operations, dateRange: { start, end },
            totalRefunds
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
};

module.exports = {
    getAnalytics
};
