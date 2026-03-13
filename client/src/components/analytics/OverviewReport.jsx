import React from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
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
    BarElement } from 'chart.js';
import { useCurrency } from '../../context/CurrencyContext';

// Register ChartJS components locally to ensure they render
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement
);

const OverviewReport = ({ data }) => {
    const { formatPrice } = useCurrency();
    const {
        summary,
        trends,
        revenueTrends, // Fallback
        revenueBySource,
        topProducts,
        topTrainers,
        insights
    } = data;

    // Helper for trend display
    const TrendIndicator = ({ value }) => (
        <span className={value >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
            {value > 0 ? '+' : ''}{value}%
        </span>
    );

    // -- Charts Data Configuration (Copied from OverviewView) --
    const lineChartData = {
        labels: trends?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Revenue',
                data: trends?.revenue || revenueTrends,
                borderColor: '#10b981', // Emerald 500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true },
            {
                label: 'Expenses',
                data: trends?.expenses || [],
                borderColor: '#f43f5e', // Rose 500
                backgroundColor: 'rgba(244, 63, 94, 0.05)',
                tension: 0.4,
                fill: true,
                borderDash: [5, 5]
            }
        ]
    };

    const doughnutData = {
        labels: ['Membership', 'Training', 'Store', 'POS'],
        datasets: [
            {
                data: [
                    revenueBySource.membership,
                    revenueBySource.training,
                    revenueBySource.store,
                    revenueBySource.pos
                ],
                backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
                borderWidth: 0 }
        ]
    };

    const chartOptions = {
        responsive: true,
        animation: false, // Disable animation for print
        plugins: {
            legend: { position: 'top', labels: { font: { size: 10 } } }
        },
        scales: {
            x: { ticks: { font: { size: 10 } } },
            y: { ticks: { font: { size: 10 } } }
        }
    };

    return (
        <div className="w-full space-y-8 font-sans">
            {/* 1. KPIs */}
            <div className="grid grid-cols-4 gap-4">
                {/* Total Revenue */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{formatPrice(summary.revenue)}</p>
                    <div className="text-xs text-gray-500 mt-1">
                        <TrendIndicator value={summary.revenueGrowth} /> vs previous period
                    </div>
                </div>

                {/* Total Expenses */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Total Expenses</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{formatPrice(summary.expenses)}</p>
                    <div className="text-xs text-gray-500 mt-1">
                        <TrendIndicator value={summary.expenseGrowth} /> vs previous period
                    </div>
                </div>

                {/* Net Profit */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Net Profit</p>
                    <p className={`text-2xl font-bold mt-1 ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatPrice(summary.netProfit)}
                    </p>
                </div>

                {/* Profit Margin */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm font-bold uppercase">Profit Margin</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{summary.profitMargin}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {summary.netProfit >= 0 ? "Healthy Logic" : "Attention Required"}
                    </p>
                </div>
            </div>

            {/* 2. Key Insights */}
            {insights && insights.length > 0 && (
                <div>
                    <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Key Insights</h3>
                    <ul className="space-y-1 pl-4 list-disc text-sm text-gray-700">
                        {insights.map((insight, idx) => (
                            <li key={idx}>{insight}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 3. Charts Row */}
            <div className="grid grid-cols-3 gap-8">
                <div className="col-span-2">
                    <h3 className="text-gray-800 font-bold text-lg">Revenue vs Expenses</h3>
                    <p className="text-xs text-gray-500 mb-4">Financial performance over time</p>
                    <div className="h-64 border border-gray-100 rounded p-2">
                        <Line data={lineChartData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                    </div>
                </div>
                <div className="col-span-1">
                    <h3 className="text-gray-800 font-bold text-lg">Revenue Sources</h3>
                    <p className="text-xs text-gray-500 mb-4">Where is money coming from?</p>
                    <div className="h-64 flex justify-center border border-gray-100 rounded p-2">
                        <Doughnut data={doughnutData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>

            {/* 4. Lists Row */}
            <div className="grid grid-cols-2 gap-8">
                {/* Top Products */}
                <div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
                        <h3 className="text-gray-800 font-bold text-lg">Top Products</h3>
                        <span className="text-xs text-blue-600">View All</span>
                    </div>
                    <div className="space-y-4">
                        {topProducts.slice(0, 5).map((p, i) => (
                            <div key={i} className="flex items-start gap-4 p-2 bg-gray-50 rounded">
                                <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full 
                                    ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                        i === 1 ? 'bg-gray-200 text-gray-700' :
                                            i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500'}`}>
                                    #{i + 1}
                                </span>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-gray-800">{p.name}</p>
                                    <p className="text-xs text-gray-500 uppercase">{p.category}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm">PHP {p.price}</p>
                                    <p className="text-xs text-green-600 font-bold">{p.margin}% Margin</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Trainers */}
                <div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
                        <h3 className="text-gray-800 font-bold text-lg">Top Trainers</h3>
                        <span className="text-xs text-blue-600">View All</span>
                    </div>
                    <div className="space-y-4">
                        {topTrainers.slice(0, 5).map((t, i) => (
                            <div key={i} className="flex items-start gap-4 p-2 bg-gray-50 rounded">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                    {t.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-gray-800">{t.name}</p>
                                    <p className="text-xs text-gray-500">{t.sessions} Sessions</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm">{formatPrice(t.revenue)}</p>
                                    <p className="text-xs text-green-600">Net: {formatPrice(t.netGymProfit)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OverviewReport;
