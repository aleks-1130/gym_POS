import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);
import { TrendingUp, DollarSign, PieChart } from 'lucide-react';

const ProfitabilityView = ({ data, dateRange }) => {
    const { summary, trends, topCategories, topTrainers, topProducts, revenueBySource } = data;

    const formatPrice = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    // Profit Trend Chart (Net Profit over time)
    const profitTrendData = {
        labels: trends.labels,
        datasets: [
            {
                label: 'Net Profit',
                data: trends.revenue.map((rev, i) => rev - (trends.expenses[i] || 0)),
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
        }
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-sm font-medium mb-1">Net Profit</p>
                    <h3 className={`text-3xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPrice(summary.netProfit)}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/5 ${parseFloat(summary.profitGrowth) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {parseFloat(summary.profitGrowth) >= 0 ? '+' : ''}{summary.profitGrowth}%
                        </span>
                        <span className="text-xs text-text-muted">vs last period</span>
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-sm font-medium mb-1">Profit Margin</p>
                    <h3 className="text-3xl font-bold text-purple-400">{summary.profitMargin}%</h3>
                    <p className="text-xs text-text-muted mt-2">Target: &gt;20%</p>
                </div>

                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-sm font-medium mb-1">Total Expenses</p>
                    <h3 className="text-3xl font-bold text-orange-400">{formatPrice(summary.expenses)}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/5 ${parseFloat(summary.expenseGrowth) <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {parseFloat(summary.expenseGrowth) > 0 ? '+' : ''}{summary.expenseGrowth}%
                        </span>
                        <span className="text-xs text-text-muted">vs last period</span>
                    </div>
                </div>
            </div>

            {/* Profit Trend Chart */}
            <div className="bg-surface p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Net Profit Trend</h3>
                <div className="h-64">
                    <Line data={profitTrendData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                </div>
            </div>

            {/* Cost Breakdown & Efficiency Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cost Structure Chart */}
                <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white">Cost Structure Analysis</h3>
                        <button
                            onClick={() => {
                                if (!dateRange) return;
                                const url = `/analytics/report/pnl?startDate=${dateRange.start}&endDate=${dateRange.end}`;
                                window.open(url, '_blank');
                            }}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                        >
                            <DollarSign size={16} />
                            View P&L Statement
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-48 flex justify-center">
                            <Doughnut
                                data={{
                                    labels: ['Product Costs', 'Trainer Commissions', 'Operating Expenses'],
                                    datasets: [{
                                        data: [summary.totalSupplyCost || 0, summary.totalCommission || 0, summary.expenses],
                                        backgroundColor: ['#f43f5e', '#a855f7', '#f59e0b'],
                                        borderWidth: 0
                                    }]
                                }}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } }
                                }}
                            />
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-text-muted mb-2">Expense Allocation</h4>

                            {/* Product Costs Bar */}
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-white">Product Supply Costs</span>
                                    <span className="text-rose-400">{formatPrice(summary.totalSupplyCost || 0)}</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-rose-500 h-full" style={{ width: `${((summary.totalSupplyCost || 0) / (summary.expenses + (summary.totalSupplyCost || 0) + (summary.totalCommission || 0))) * 100}%` }}></div>
                                </div>
                                <p className="text-[10px] text-text-muted mt-1">
                                    {revenueBySource && (data.revenueBySource.store + data.revenueBySource.pos) > 0
                                        ? (((summary.totalSupplyCost || 0) / (data.revenueBySource.store + data.revenueBySource.pos)) * 100).toFixed(1)
                                        : 0}% of Retail Revenue
                                </p>
                            </div>

                            {/* Commissions Bar */}
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-white">Trainer Commissions</span>
                                    <span className="text-purple-400">{formatPrice(summary.totalCommission || 0)}</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-purple-500 h-full" style={{ width: `${((summary.totalCommission || 0) / (summary.expenses + (summary.totalSupplyCost || 0) + (summary.totalCommission || 0))) * 100}%` }}></div>
                                </div>
                                <p className="text-[10px] text-text-muted mt-1">
                                    {revenueBySource && data.revenueBySource.training > 0
                                        ? (((summary.totalCommission || 0) / data.revenueBySource.training) * 100).toFixed(1)
                                        : 0}% of Training Revenue
                                </p>
                            </div>

                            {/* OpEx Bar */}
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-white">Operating Expenses</span>
                                    <span className="text-orange-400">{formatPrice(summary.expenses)}</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-orange-500 h-full" style={{ width: `${(summary.expenses / (summary.expenses + (summary.totalSupplyCost || 0) + (summary.totalCommission || 0))) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Efficiency Metrics (Vertical Cards) */}
                <div className="space-y-6">
                    <div className="bg-surface p-6 rounded-2xl border border-white/5 h-full flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-white mb-4">Efficiency Metrics</h3>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-text-muted">Return on Sales (Net Margin)</p>
                                    <p className="text-xl font-bold text-white">{summary.profitMargin}%</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                                    <DollarSign size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-text-muted">Gross Profit</p>
                                    <p className="text-xl font-bold text-white">
                                        {formatPrice(summary.revenue - ((summary.totalSupplyCost || 0) + (summary.totalCommission || 0)))}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400">
                                    <PieChart size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-text-muted">Cost Efficiency</p>
                                    <p className="text-xl font-bold text-white">
                                        {summary.revenue > 0 ? (100 - (summary.profitMargin)).toFixed(1) : 0}%
                                    </p>
                                    <p className="text-[10px] text-text-muted">Expenses as % of Revenue</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Profitability */}
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4"> mostProfitable Categories</h3>
                    <div className="space-y-4">
                        {topCategories.map((cat, idx) => {
                            const margin = cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) : 0;
                            return (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{cat.category}</p>
                                            <p className="text-xs text-text-muted">{margin}% Margin</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">{formatPrice(cat.profit)}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Top Profitable Products */}
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">High Margin Products</h3>
                    <div className="space-y-4">
                        {topProducts.sort((a, b) => b.margin - a.margin).slice(0, 5).map((prod, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white">{prod.name}</p>
                                    <div className="w-full bg-white/10 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                        <div className="bg-purple-400 h-full rounded-full" style={{ width: `${prod.margin}%` }}></div>
                                    </div>
                                </div>
                                <div className="text-right ml-4 min-w-[80px]">
                                    <p className="text-sm font-bold text-purple-400">{prod.margin}%</p>
                                    <p className="text-xs text-text-muted">{formatPrice(prod.totalProfit)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ProfitabilityView;
