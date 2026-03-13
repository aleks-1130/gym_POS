import React from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
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
    ArcElement,
    BarElement,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement,
    Filler
);

const ProfitabilityReport = ({ data }) => {
    const { formatPrice } = useCurrency();
    const {
        summary,
        trends,
        revenueTrends, // Fallback
        expenseBreakdown,
        topCategories,
        topProducts,
        itemMargins // Assuming this is available or derived
    } = data;

    // Helper for trend display
    const TrendIndicator = ({ value }) => (
        <span className={value >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
            {value > 0 ? '+' : ''}{value}%
        </span>
    );

    // -- Charts --
    const netProfitData = {
        labels: trends?.labels || [],
        datasets: [
            {
                label: 'Net Profit',
                data: trends?.revenue.map((r, i) => r - (trends.expenses[i] || 0)) || [],
                borderColor: '#8b5cf6', // Violet
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true }
        ]
    };

    const costStructureData = {
        labels: expenseBreakdown.map(e => e.category),
        datasets: [
            {
                data: expenseBreakdown.map(e => e.amount),
                backgroundColor: [
                    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#6366f1'
                ],
                borderWidth: 0 }
        ]
    };

    const chartOptions = {
        responsive: true,
        animation: false,
        plugins: { legend: { position: 'top' } },
        scales: { x: { display: true }, y: { display: true } }
    };

    return (
        <div className="w-full space-y-8 font-sans">
            {/* 1. KPIs */}
            <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Net Profit</p>
                    <p className={`text-2xl font-bold mt-1 ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatPrice(summary.netProfit)}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                        <TrendIndicator value={summary.profitGrowth} /> vs previous period
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Profit Margin</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{summary.profitMargin}%</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Total Expenses</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{formatPrice(summary.expenses)}</p>
                    <div className="text-xs text-gray-500 mt-1">
                        <TrendIndicator value={summary.expenseGrowth} /> vs previous period
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Expense Ratio</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">
                        {summary.revenue > 0 ? ((summary.expenses / summary.revenue) * 100).toFixed(1) : 0}%
                    </p>
                </div>
            </div>

            {/* 2. Charts Row */}
            <div className="grid grid-cols-2 gap-8">
                <div>
                    <h3 className="text-gray-800 font-bold text-lg mb-2">Net Profit Trend</h3>
                    <div className="h-64 border border-gray-100 rounded p-2">
                        <Line data={netProfitData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                    </div>
                </div>
                <div>
                    <h3 className="text-gray-800 font-bold text-lg mb-2">Cost Structure (Expenses)</h3>
                    <div className="h-64 flex justify-center border border-gray-100 rounded p-2">
                        <Doughnut data={costStructureData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>

            {/* 3. Detailed Metrics */}
            <div className="grid grid-cols-2 gap-8">
                {/* Most Profitable Categories */}
                <div>
                    <h3 className="text-gray-800 font-bold text-lg mb-4 border-b pb-2">Most Profitable Categories</h3>
                    <div className="space-y-3">
                        {topCategories.slice(0, 5).map((cat, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                                <span className="font-medium">{cat.category}</span>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-600">{formatPrice(cat.profit)}</p>
                                    <p className="text-xs text-gray-500">{cat.margin}% Margin</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* High Margin Products */}
                <div>
                    <h3 className="text-gray-800 font-bold text-lg mb-4 border-b pb-2">High Margin Products</h3>
                    <div className="space-y-3">
                        {topProducts
                            .sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin)) // Sort by margin
                            .slice(0, 5)
                            .map((p, i) => (
                                <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                                    <div>
                                        <p className="font-medium text-sm">{p.name}</p>
                                        <p className="text-xs text-gray-500">{p.category}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-purple-600">{p.margin}%</p>
                                        <p className="text-xs text-gray-500">{formatPrice(p.price)}</p>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* 4. Efficiency Metrics */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Efficiency Metrics</h3>
                <div className="grid grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 uppercase mb-1">Return on Sales</p>
                        <p className="text-xl font-bold text-gray-800">{summary.profitMargin}%</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 uppercase mb-1">Revenue per Booking</p>
                        {/* Placeholder - assuming we have booking data count or using trainer sessions */}
                        <p className="text-xl font-bold text-gray-800">
                            {formatPrice(data.topTrainers.reduce((acc, t) => acc + t.sessions, 0) > 0
                                ? data.revenueBySource.training / data.topTrainers.reduce((acc, t) => acc + t.sessions, 0)
                                : 0)}
                        </p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 uppercase mb-1">Avg Transaction Value</p>
                        <p className="text-xl font-bold text-gray-800">
                            {formatPrice(data.transactionCount > 0 ? summary.revenue / data.transactionCount : 0)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfitabilityReport;
