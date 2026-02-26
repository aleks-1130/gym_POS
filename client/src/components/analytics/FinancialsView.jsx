import React from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { TrendingUp, DollarSign, Activity, ShoppingBag } from 'lucide-react';
import DataTable from '../common/DataTable';

const FinancialsView = ({ data, dateRange }) => {
    const { summary, trends, topCategories, revenueBySource } = data;
    const formatPrice = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    // -- Calculations for Display --
    const dailyAvg = summary.revenue / (trends.labels?.length || 7);

    // Gross Profit = Revenue - COGS - Commissions
    // Backend now sends these values
    const cogs = summary.totalSupplyCost || 0;
    const commissions = summary.totalCommission || 0;
    const variableCosts = cogs + commissions;
    const grossProfit = summary.revenue - variableCosts;
    const grossMargin = summary.revenue > 0 ? (grossProfit / summary.revenue) * 100 : 0;

    const operatingExpenses = summary.operatingExpenses || (summary.expenses - variableCosts);

    // Revenue Composition (Doughnut)
    const revenueSourceData = {
        labels: ['Membership', 'Training', 'Store', 'POS', 'Day Pass'],
        datasets: [{
            data: [
                revenueBySource.membership,
                revenueBySource.training,
                revenueBySource.store,
                revenueBySource.pos,
                revenueBySource.dayPass || 0
            ],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'],
            borderWidth: 0
        }]
    };

    // Cost Structure (Doughnut)
    const costStructureData = {
        labels: ['Operating Expenses', 'Product Costs (COGS)', 'Commissions'],
        datasets: [{
            data: [operatingExpenses, cogs, commissions],
            backgroundColor: ['#f97316', '#f43f5e', '#a855f7'],
            borderWidth: 0
        }]
    };

    // Net Profit Trend (Line)
    // Adjust trend to ideally show gross vs net if possible, but keeping simple net profit for now
    const profitTrendData = {
        labels: trends.labels,
        datasets: [
            {
                label: 'Net Profit',
                data: trends.revenue.map((rev, i) => {
                    // This is an approximation since we don't have daily COGS/Comm in trends
                    // Fallback to proportional calculation or just Rev - OpEx if that's what backend sent
                    // Backend sends trends.expenses which is Operating Expenses.
                    // So this line chart calculates "Operating Profit" (Rev - OpEx).
                    // To make it accurate Net Profit, we should deduct estimated daily variable costs.
                    // For now, let's just stick to the backend's "Net Profit" which is mostly accurate 
                    // if trends.expenses included everything, but it doesn't.
                    // Let's explicitly label it "Operating Cash Flow" if we can't be precise, 
                    // OR just deduct the average variable cost % from revenue?
                    const dailyRev = rev;
                    const dailyOpEx = trends.expenses[i] || 0;
                    // Est Variable Cost
                    const varCostRatio = summary.revenue > 0 ? variableCosts / summary.revenue : 0;
                    const dailyVarCost = dailyRev * varCostRatio;
                    return dailyRev - dailyOpEx - dailyVarCost;
                }),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                fill: true,
                tension: 0.4
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
        },
        maintainAspectRatio: false
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* --- Section 1: Revenue Overview --- */}
            <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="text-blue-400" /> Revenue Overview
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Revenue Stats - Enhanced Hierarchy */}
                    <div className="col-span-1 lg:col-span-1 space-y-4">
                        {/* BIG Total Revenue */}
                        <div className="bg-surface p-8 rounded-2xl border border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <DollarSign size={100} />
                            </div>
                            <p className="text-gray-400 font-medium mb-1">Total Revenue</p>
                            <h3 className="text-4xl md:text-5xl font-bold text-white mb-4">{formatPrice(summary.revenue)}</h3>

                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold px-2 py-1 rounded-md ${parseFloat(summary.revenueGrowth) >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                    {parseFloat(summary.revenueGrowth) >= 0 ? '+' : ''}{summary.revenueGrowth}%
                                </span>
                                <span className="text-sm text-gray-500">vs last period</span>
                            </div>
                        </div>

                        {/* Avg Daily */}
                        <div className="bg-surface p-6 rounded-2xl border border-white/5 flex justify-between items-center">
                            <div>
                                <p className="text-text-muted text-sm font-medium">Avg Daily Revenue</p>
                                <h3 className="text-2xl font-bold text-gray-200">{formatPrice(dailyAvg)}</h3>
                            </div>
                            <div className="p-3 bg-blue-500/10 rounded-full">
                                <Activity className="text-blue-400" size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Revenue Composition Chart */}
                    <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4">Revenue Sources</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="h-48 flex justify-center">
                                <Doughnut data={revenueSourceData} options={{ ...chartOptions, plugins: { legend: { display: false } } }} />
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { label: 'Membership', value: revenueBySource.membership, color: 'bg-blue-500' },
                                    { label: 'Training', value: revenueBySource.training, color: 'bg-purple-500' },
                                    { label: 'Retail (Store)', value: revenueBySource.store, color: 'bg-emerald-500' },
                                    { label: 'POS (Walk-in)', value: revenueBySource.pos, color: 'bg-amber-500' },
                                    { label: 'Day Passes', value: revenueBySource.dayPass, color: 'bg-pink-500' },
                                ].map((item, i) => (
                                    (item.value > 0) && (
                                        <div key={i} className="flex justify-between items-center p-2 hover:bg-white/5 rounded transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                                                <span className="text-sm text-gray-300">{item.label}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-white block">{formatPrice(item.value)}</span>
                                                <span className="text-xs text-gray-500">{((item.value / summary.revenue) * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 2: Financial Health (Cost & Profit) --- */}
            <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" /> Financial Health
                </h2>

                {/* Profit KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {/* Gross Profit */}
                    <div className="p-5 bg-surface rounded-xl border border-white/5 shadow-lg">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-gray-400 text-xs uppercase tracking-wider font-bold">Gross Profit</p>
                            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded animate-pulse">{grossMargin.toFixed(1)}% Margin</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white">{formatPrice(grossProfit)}</h3>
                        <p className="text-xs text-gray-500 mt-1">Rev - (COGS + Comm)</p>
                    </div>

                    {/* Operating Expenses */}
                    <div className="p-5 bg-surface rounded-xl border border-white/5 shadow-lg">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-2">Operating Expenses</p>
                        <h3 className="text-2xl font-bold text-orange-400">{formatPrice(operatingExpenses)}</h3>
                        <p className="text-xs text-text-muted mt-1">{((operatingExpenses / summary.revenue) * 100).toFixed(1)}% of Revenue</p>
                    </div>

                    {/* Net Profit */}
                    <div className="p-5 bg-surface rounded-xl border border-emerald-500/20 shadow-lg relative overflow-hidden">
                        <div className="absolute inset-0 bg-emerald-500/5"></div>
                        <div className="relative z-10">
                            <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-2">Net Profit</p>
                            <h3 className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatPrice(summary.netProfit)}
                            </h3>
                            <p className="text-xs text-emerald-500/80 mt-1 font-bold">{summary.profitMargin}% Net Margin</p>
                        </div>
                    </div>

                    {/* Total Refunds */}
                    <div className="p-5 bg-surface rounded-xl border border-amber-500/20 shadow-lg relative overflow-hidden">
                        <div className="absolute inset-0 bg-amber-500/5"></div>
                        <div className="relative z-10">
                            <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-2">Total Refunds</p>
                            <h3 className="text-2xl font-bold text-amber-400">-{formatPrice(data.totalRefunds || 0)}</h3>
                            <p className="text-xs text-amber-500/80 mt-1 font-bold">Returns & Voids</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Cost Structure Analysis */}
                    <div className="bg-surface p-6 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4">Cost Breakdown</h3>
                        <div className="h-48 flex justify-center mb-6">
                            <Doughnut data={costStructureData} options={{ ...chartOptions, plugins: { legend: { display: false } } }} />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                    <span className="text-gray-400">Operating (Rent, etc)</span>
                                </div>
                                <span className="text-white font-medium">{formatPrice(operatingExpenses)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                    <span className="text-gray-400">Product Costs (COGS)</span>
                                </div>
                                <span className="text-white font-medium">{formatPrice(cogs)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                    <span className="text-gray-400">Staff Commissions</span>
                                </div>
                                <span className="text-white font-medium">{formatPrice(commissions)}</span>
                            </div>
                            <div className="border-t border-white/10 pt-2 mt-2 flex justify-between items-center">
                                <span className="text-gray-300 font-bold">Total Expenses</span>
                                <span className="text-orange-400 font-bold">{formatPrice(summary.expenses)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Net Profit Trend Chart */}
                    <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Net Profit Trend</h3>
                            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">Estimated based on daily avg costs</span>
                        </div>
                        <div className="h-64">
                            <Line data={profitTrendData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 3: Retail Performance --- */}
            <div className="bg-surface p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <ShoppingBag className="text-purple-400" /> Retail Profitability by Category
                </h3>
                <DataTable
                    columns={[
                        {
                            header: "Category",
                            accessor: (row) => <span className="font-bold text-white">{row.category}</span>
                        },
                        {
                            header: "Revenue",
                            accessor: (row) => <span className="text-gray-300">{formatPrice(row.revenue)}</span>,
                            className: "text-right",
                            cellClassName: "text-right"
                        },
                        {
                            header: "COGS",
                            accessor: (row) => <span className="text-gray-400">{formatPrice(row.cogs || 0)}</span>,
                            className: "text-right",
                            cellClassName: "text-right"
                        },
                        {
                            header: "Gross Profit",
                            accessor: (row) => <span className="text-emerald-400 font-bold">{formatPrice(row.profit)}</span>,
                            className: "text-right",
                            cellClassName: "text-right"
                        },
                        {
                            header: "Margin",
                            accessor: (row) => {
                                const margin = row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) : 0;
                                return (
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${parseFloat(margin) > 20 ? 'bg-emerald-500/20 text-emerald-400' : parseFloat(margin) > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {margin}%
                                    </span>
                                );
                            },
                            className: "text-right",
                            cellClassName: "text-right"
                        }
                    ]}
                    data={topCategories}
                    className="border-none shadow-none bg-transparent"
                />
            </div>
        </div>
    );
};

export default FinancialsView;
