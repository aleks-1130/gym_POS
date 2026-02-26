import React from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import ExecutiveSummary from './ExecutiveSummary';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

const OverviewView = ({ data, loading, dateRange }) => {
    if (loading || !data) return <div className="text-white p-6">Loading overview...</div>;

    const {
        summary,
        revenueTrends,
        trends, // New V2 trends with labels
        peakHours,
        revenueBySource,
        topProducts,
        topTrainers,
        insights
    } = data;

    // -- Charts Data --
    const lineChartData = {
        labels: trends?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Revenue',
                data: trends?.revenue || revenueTrends, // Fallback
                borderColor: '#10b981', // Emerald 500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
            },
            {
                label: 'Expenses',
                data: trends?.expenses || [], // New
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
                borderWidth: 0,
                hoverOffset: 4
            }
        ]
    };

    // Peak Hours Chart (Bar)
    const peakHoursData = {
        labels: ['6-9 AM', '9-12 PM', '12-3 PM', '3-6 PM', '6-9 PM', '9-12 AM'],
        datasets: [
            {
                label: 'Activity Level',
                data: peakHours,
                backgroundColor: '#3b82f6',
                borderRadius: 4,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top', labels: { color: '#9ca3af', font: { size: 12 } } },
            tooltip: {
                backgroundColor: '#1f2937',
                titleColor: '#f3f4f6',
                bodyColor: '#d1d5db',
                padding: 12,
                cornerRadius: 8,
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1
            }
        },
        scales: {
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#6b7280' } },
            x: { grid: { display: false }, ticks: { color: '#6b7280' } }
        }
    };


    return (
        <div className="space-y-6">
            {/* 1. Executive Summary */}
            <div className="relative">
                <ExecutiveSummary summary={summary} />
            </div>

            {/* 2. Insights Banner */}
            {insights && insights.length > 0 && (
                <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h4 className="text-blue-200 font-medium text-sm mb-1">Key Insights</h4>
                        <ul className="space-y-1">
                            {insights.map((insight, idx) => (
                                <li key={idx} className="text-sm text-text-muted flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                    {insight}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* 3. Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Trend (Line) - Takes 2 cols */}
                <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white">Revenue vs Expenses</h3>
                            <p className="text-sm text-text-muted">Financial performance over time</p>
                        </div>
                        {/* Optional: Legend or Filters could go here */}
                    </div>
                    <div className="h-64">
                        <Line data={lineChartData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                    </div>
                </div>

                {/* Revenue Sources (Doughnut) */}
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-2">Revenue Sources</h3>
                    <p className="text-sm text-text-muted mb-6">Where is money coming from?</p>
                    <div className="h-48 flex justify-center">
                        <Doughnut data={doughnutData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'bottom' } }, maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>

            {/* 4. Leaderboards Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">Top Products</h3>
                        <button className="text-xs text-primary hover:text-primary-hover">View All</button>
                    </div>
                    <div className="space-y-3">
                        {topProducts.slice(0, 5).map((product, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                        idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                                            idx === 2 ? 'bg-orange-500/20 text-orange-500' : 'bg-white/5 text-text-muted'
                                        }`}>
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-white">{product.name}</p>
                                        <p className="text-xs text-text-muted">{product.category}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-emerald-400">PHP {product.totalProfit}</p>
                                    <p className="text-xs text-text-muted">{product.margin}% Margin</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Trainers */}
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">Top Trainers</h3>
                        <button className="text-xs text-primary hover:text-primary-hover">View All</button>
                    </div>
                    <div className="space-y-3">
                        {topTrainers.slice(0, 5).map((trainer, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                        {trainer.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{trainer.name}</p>
                                        <p className="text-xs text-text-muted">{trainer.sessions} Sessions</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">PHP {trainer.revenue}</p>
                                    <p className="text-xs text-emerald-400">Net: {trainer.netGymProfit}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OverviewView;
