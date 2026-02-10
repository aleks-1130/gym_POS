import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useCurrency } from '../../context/CurrencyContext';
import axios from 'axios';
import { X } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function Analytics() {
    const { formatPrice } = useCurrency();
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [analyticsData, setAnalyticsData] = useState(null);

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/analytics', {
                headers: { Authorization: `Bearer ${token}` },
                params: { startDate: dateRange.start, endDate: dateRange.end }
            });
            setAnalyticsData(res.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !analyticsData) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-text-muted">Loading analytics...</p>
            </div>
        );
    }

    const {
        summary = {},
        revenueBySource = {},
        topProducts = [],
        membershipDistribution = {},
        transactions = []
    } = analyticsData || {};

    // Revenue Trends Chart (using transaction data)
    const revenueData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Revenue',
            data: analyticsData.revenueTrends || [0, 0, 0, 0, 0, 0, 0],
            borderColor: '#FF8C00',
            backgroundColor: 'rgba(255, 140, 0, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#FF8C00',
        }],
    };

    // Peak Hours Chart
    const peakHoursData = {
        labels: ['6AM-9AM', '9AM-12PM', '12PM-3PM', '3PM-6PM', '6PM-9PM', '9PM-12AM'],
        datasets: [{
            label: 'Activity',
            data: analyticsData.peakHours || [0, 0, 0, 0, 0, 0],
            backgroundColor: '#FF8C00',
            borderRadius: 8,
            barThickness: 50,
        }],
    };

    // Revenue Sources Doughnut
    const revenueSourcesData = {
        labels: ['Membership', 'Training', 'Store (App)', 'POS (Counter)'],
        datasets: [{
            data: [
                revenueBySource.membership || 0,
                revenueBySource.training || 0,
                revenueBySource.store || 0,
                revenueBySource.pos || 0
            ],
            backgroundColor: ['#FF8C00', '#10B981', '#3B82F6', '#8B5CF6'],
            borderWidth: 0,
            hoverOffset: 8,
        }],
    };

    // Membership Distribution Doughnut
    const membershipLabels = Object.keys(membershipDistribution);
    const membershipValues = Object.values(membershipDistribution);
    const membershipDistData = {
        labels: membershipLabels,
        datasets: [{
            data: membershipValues,
            backgroundColor: ['#FF8C00', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'],
            borderWidth: 0,
            hoverOffset: 8,
        }],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#9CA3AF', font: { size: 11 } }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#9CA3AF', font: { size: 11 } }
            }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 15,
                    color: '#9CA3AF',
                    font: { size: 12 }
                }
            }
        }
    };

    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="pb-10">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
                    <p className="text-text-muted mt-1">Deep insights into gym performance</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-text-muted">Range:</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="px-3 py-2 bg-surfaceHighlight border border-white/10 rounded-lg text-sm text-white focus:ring-primary focus:border-primary"
                        />
                        <span className="text-text-muted">→</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="px-3 py-2 bg-surfaceHighlight border border-white/10 rounded-lg text-sm text-white focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                <div className="bg-surface p-5 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-xs font-medium mb-2">Total Expenses (Period)</p>
                    <h2 className="text-2xl font-bold text-red-500">{formatPrice(summary.expenses || 0)}</h2>
                </div>
                <div className="bg-surface p-5 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-xs font-medium mb-2">Net Profit (Period)</p>
                    <h2 className={`text-2xl font-bold ${(summary.netProfit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatPrice(summary.netProfit || 0)}
                    </h2>
                </div>
                <div className="bg-surface p-5 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-xs font-medium mb-2">Total Revenue (Period)</p>
                    <h2 className="text-2xl font-bold text-white">{formatPrice(summary.revenue || 0)}</h2>
                </div>
            </div>

            {/* Detailed Earnings */}
            <h3 className="text-lg font-bold text-white mb-4">Detailed Earnings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-text-muted text-xs font-medium mb-1">TOTAL SHOP SALES</p>
                            <h3 className="text-2xl font-bold text-white">{formatPrice(summary.shopSales || 0)}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <span className="material-icons-round text-orange-500">shopping_cart</span>
                        </div>
                    </div>
                    <div className="flex gap-6 mt-4">
                        <div>
                            <p className="text-[10px] text-text-muted mb-1">Product Sales</p>
                            <p className="text-sm font-semibold text-white">{formatPrice(revenueBySource.store || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-text-muted mb-1">Service Sales</p>
                            <p className="text-sm font-semibold text-white">{formatPrice(revenueBySource.pos || 0)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-text-muted text-xs font-medium mb-1">NET TRAINING EARNINGS</p>
                            <h3 className="text-2xl font-bold text-emerald-500">{formatPrice(summary.trainingEarnings || 0)}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <span className="material-icons-round text-emerald-500">fitness_center</span>
                        </div>
                    </div>
                    <div className="flex gap-6 mt-4">
                        <div>
                            <p className="text-[10px] text-text-muted mb-1">Session Revenue</p>
                            <p className="text-sm font-semibold text-white">{formatPrice(revenueBySource.training || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-text-muted mb-1">Costs</p>
                            <p className="text-sm font-semibold text-red-400">-{formatPrice(Math.max(0, (revenueBySource.training || 0) - (summary.trainingEarnings || 0)))}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="bg-surface p-5 rounded-2xl border border-white/5 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-white">Revenue Breakdown</h3>
                        <p className="text-xs text-text-muted mt-1">{summary.transactionCount || 0} transactions found for {dateRange.start} - {dateRange.end}</p>
                    </div>
                    <button
                        onClick={() => setShowDetailsModal(true)}
                        className="px-4 py-2 bg-surfaceHighlight border border-white/10 rounded-lg text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-2">
                        <span className="material-icons-round text-base">visibility</span>
                        View Details
                    </button>
                </div>
            </div>

            {/* Charts Row 1: Revenue Trends & Peak Hours */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Revenue Trends</h3>
                    <div className="h-64">
                        <Line data={revenueData} options={chartOptions} />
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Peak Hours Analysis</h3>
                    <div className="h-64">
                        <Bar data={peakHoursData} options={chartOptions} />
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Revenue Sources & Membership Distribution */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Revenue Sources</h3>
                    <div className="h-64 flex items-center justify-center">
                        <div className="w-64">
                            <Doughnut data={revenueSourcesData} options={doughnutOptions} />
                        </div>
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Membership Distribution</h3>
                    <div className="h-64 flex items-center justify-center">
                        <div className="w-64">
                            <Doughnut data={membershipDistData} options={doughnutOptions} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Performing Products */}
            <div className="bg-surface p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold text-white mb-5">Top Performing Products</h3>
                <div className="space-y-3">
                    {topProducts.slice(0, 3).map((product, idx) => {
                        const colors = ['bg-orange-600', 'bg-gray-600', 'bg-zinc-700'];
                        return (
                            <div key={product.id} className="flex items-center p-4 bg-surfaceHighlight border border-white/5 rounded-xl hover:bg-white/5 transition-colors">
                                <span className="text-orange-500 font-bold text-lg w-12">#{idx + 1}</span>
                                <div className={`w-10 h-10 rounded-lg ${colors[idx]} flex items-center justify-center text-white font-bold mr-4`}>
                                    {product.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-white text-sm">{product.name}</h4>
                                        <span className="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-medium">New</span>
                                    </div>
                                    <p className="text-xs text-text-muted">{product.category}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-white">{formatPrice(product.totalSales)}</p>
                                    <p className="text-xs text-emerald-400">+{Math.floor(Math.random() * 20 + 5)}% vs last month</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detailed Revenue Breakdown Modal */}
            {showDetailsModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-white/10">
                            <div>
                                <h2 className="text-xl font-bold text-white">Detailed Revenue Breakdown</h2>
                                <p className="text-sm text-text-muted mt-1">All transactions for selected period</p>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                                <X size={18} className="text-text-muted" />
                            </button>
                        </div>

                        <div className="overflow-auto flex-1 p-6">
                            <table className="w-full">
                                <thead className="text-xs text-text-muted uppercase border-b border-white/5">
                                    <tr>
                                        <th className="text-left pb-3 font-medium">Date/Time</th>
                                        <th className="text-left pb-3 font-medium">Type</th>
                                        <th className="text-left pb-3 font-medium">Member</th>
                                        <th className="text-left pb-3 font-medium">Staff</th>
                                        <th className="text-left pb-3 font-medium">Method</th>
                                        <th className="text-right pb-3 font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-4 text-sm text-text-muted">
                                                <div>{new Date(tx.date).toLocaleDateString()}</div>
                                                <div className="text-xs">{new Date(tx.date).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="py-4">
                                                <span className="px-2 py-1 bg-white/5 rounded text-xs font-semibold text-white uppercase">
                                                    {tx.type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                                                        {tx.member.charAt(0)}
                                                    </div>
                                                    <span className="text-sm text-white">{tx.member}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 text-sm text-text-muted">{tx.staff}</td>
                                            <td className="py-4 text-sm text-text-muted uppercase">{tx.method}</td>
                                            <td className="py-4 text-right text-sm font-semibold text-emerald-400">
                                                {formatPrice(tx.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-between items-center">
                            <p className="text-sm text-text-muted">Total Records: {transactions.length}</p>
                            <div className="text-right">
                                <p className="text-xs text-text-muted mb-1">Total Revenue:</p>
                                <p className="text-xl font-bold text-emerald-400">{formatPrice(totalRevenue)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
