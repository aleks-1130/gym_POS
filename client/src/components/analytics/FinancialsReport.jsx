import React from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { useCurrency } from '../../context/CurrencyContext';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement } from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const FinancialsReport = ({ data }) => {
    const { formatPrice } = useCurrency();
    const {
        summary,
        trends,
        revenueBySource,
        topCategories,
        expenseBreakdown
    } = data;

    // -- Calculations --
    const cogs = summary.totalSupplyCost || 0;
    const commissions = summary.totalCommission || 0;
    const variableCosts = cogs + commissions;
    const operatingExpenses = summary.operatingExpenses || (summary.expenses - variableCosts);

    const grossProfit = summary.revenue - variableCosts;
    const grossMargin = summary.revenue > 0 ? (grossProfit / summary.revenue) * 100 : 0;

    // Helper for trend display
    const TrendIndicator = ({ value }) => (
        <span className={value >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
            {value > 0 ? '+' : ''}{value}%
        </span>
    );

    // -- Chart Data --
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

    const costStructureData = {
        labels: ['Operating Expenses', 'Product Costs (COGS)', 'Commissions'],
        datasets: [{
            data: [operatingExpenses, cogs, commissions],
            backgroundColor: ['#f97316', '#f43f5e', '#a855f7'],
            borderWidth: 0
        }]
    };

    const profitTrendData = {
        labels: trends?.labels || [],
        datasets: [
            {
                label: 'Net Profit',
                data: trends?.revenue.map((r, i) => {
                    const dailyRev = r;
                    const dailyOpEx = trends.expenses[i] || 0;
                    const varCostRatio = summary.revenue > 0 ? variableCosts / summary.revenue : 0;
                    return dailyRev - dailyOpEx - (dailyRev * varCostRatio);
                }) || [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true }
        ]
    };

    const chartOptions = {
        responsive: true,
        animation: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, padding: 10 } } },
        maintainAspectRatio: false
    };

    return (
        <div className="w-full space-y-8 font-sans">
            {/* Section 1: Revenue & Gross Profit */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Financial Overview</h3>
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
                            <p className="text-2xl font-bold text-blue-600">{formatPrice(summary.revenue)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                <TrendIndicator value={summary.revenueGrowth} /> vs previous period
                            </p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase">Gross Profit</p>
                            <p className="text-2xl font-bold text-gray-800">{formatPrice(grossProfit)}</p>
                            <p className="text-xs text-gray-500 mt-1">{grossMargin.toFixed(1)}% Gross Margin</p>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2">Revenue Sources</h4>
                        <div className="h-40 border border-gray-100 rounded p-2 flex justify-center">
                            <Doughnut data={revenueSourceData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Expense Overview */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Expense Analysis</h3>
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded border border-gray-200 mb-4">
                            <p className="text-xs text-gray-500 uppercase">Total Expenses</p>
                            <p className="text-2xl font-bold text-orange-600">{formatPrice(summary.expenses)}</p>
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Operating</span>
                                    <span className="font-medium">{formatPrice(operatingExpenses)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">COGS</span>
                                    <span className="font-medium">{formatPrice(cogs)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Commissions</span>
                                    <span className="font-medium">{formatPrice(commissions)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2">Cost Structure</h4>
                        <div className="h-40 border border-gray-100 rounded p-2 flex justify-center">
                            <Doughnut data={costStructureData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 3: Profitability */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Net Profitability</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase">Net Profit</p>
                        <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPrice(summary.netProfit)}
                        </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase">Net Profit Margin</p>
                        <p className="text-2xl font-bold text-purple-600">{summary.profitMargin}%</p>
                    </div>
                </div>

                <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Net Profit Trend</h4>
                    <div className="h-48 border border-gray-100 rounded p-2">
                        <Line data={profitTrendData} options={{ ...chartOptions, plugins: { legend: { display: false } } }} />
                    </div>
                </div>
            </div>

            {/* Section 4: Top Categories */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Retail Profitability by Category</h3>
                <div className="w-full">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="p-2 font-medium text-gray-500">Category</th>
                                <th className="p-2 font-medium text-gray-500 text-right">Revenue</th>
                                <th className="p-2 font-medium text-gray-500 text-right">Profit</th>
                                <th className="p-2 font-medium text-gray-500 text-right">Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topCategories.slice(0, 5).map((cat, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                    <td className="p-2 font-medium text-gray-700">{cat.category}</td>
                                    <td className="p-2 text-right text-gray-600">{formatPrice(cat.revenue)}</td>
                                    <td className="p-2 text-right font-bold text-green-600">{formatPrice(cat.profit)}</td>
                                    <td className="p-2 text-right text-gray-500">{((cat.profit / cat.revenue) * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinancialsReport;
