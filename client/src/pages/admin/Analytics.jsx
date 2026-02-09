import React from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useCurrency } from '../../context/CurrencyContext';
import axios from 'axios';
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
<<<<<<< HEAD
    const { formatPrice, rate } = useCurrency(); // Get rate
    const [viewMode, setViewMode] = React.useState('monthly'); // 'daily' or 'monthly'
    const [stats, setStats] = React.useState(null);

    React.useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('http://localhost:5000/api/dashboard/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setStats(data); // Store full response
            } catch (e) {
                console.error("Failed to fetch stats", e);
            }
        };
        fetchStats();
    }, []);

    // Derived Data based on View Mode
    const displayData = React.useMemo(() => {
        if (!stats) return { expenses: 0, revenue: 0, profit: 0 };

        if (viewMode === 'daily') {
            return {
                label: '(Today)',
                expenses: stats.expensesToday || 0,
                revenue: stats.revenueToday || 0,
                profit: stats.netProfitToday || 0
            };
        } else {
            return {
                label: '(This Month)',
                expenses: stats.totalExpenses || 0,
                revenue: stats.monthlyRevenue || 0,
                profit: (stats.monthlyRevenue || 0) - (stats.totalExpenses || 0)
            };
        }
    }, [stats, viewMode]);

    // --- Mock Data ---
=======
    const { formatPrice } = useCurrency();
>>>>>>> 5d624b7d422135ad0a5d3556806a69ae2c59ae62

    // Stats State
    const [stats, setStats] = React.useState({
        periodRevenue: 0,
        periodExpenses: 0,
        revenueTrend: [],
        breakdown: {
            shopRevenue: 0,
            storeRevenue: 0,
            posRevenue: 0,
            trainingRevenue: 0,
            trainingExpenses: 0,
            trainingNet: 0
        }
    });

    // Detailed Breakdown State
    const [dateRange, setDateRange] = React.useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [transactions, setTransactions] = React.useState([]);
    const [loadingTx, setLoadingTx] = React.useState(false);
    const [membershipDist, setMembershipDist] = React.useState([]);
    const [showBreakdownModal, setShowBreakdownModal] = React.useState(false);

    React.useEffect(() => {
        fetchStats();
        fetchTransactions();
    }, [dateRange]);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/dashboard/stats?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats({
                periodRevenue: res.data.periodRevenue || 0,
                periodExpenses: res.data.periodExpenses || 0,
                revenueTrend: res.data.revenueTrend || [],
                breakdown: res.data.breakdown || { shopRevenue: 0, trainingRevenue: 0, trainingExpenses: 0, trainingNet: 0 },
                revenueDistribution: res.data.revenueDistribution || []
            });
            if (res.data.membershipDistribution) {
                setMembershipDist(res.data.membershipDistribution);
            }
        } catch (e) {
            console.error("Failed to fetch stats", e);
        }
    };

    const fetchTransactions = async () => {
        setLoadingTx(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/payments?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTransactions(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to fetch transactions", e);
            setTransactions([]);
        } finally {
            setLoadingTx(false);
        }
    };

    // Calculate Net Profit
    const netProfit = (stats.periodRevenue || 0) - (stats.periodExpenses || 0);

    // --- Dynamic Data for Charts ---
    // 1. Revenue Trends (Line Chart)
    const validTrends = Array.isArray(stats.revenueTrend) ? stats.revenueTrend : [];
    const revenueLabels = validTrends.map(d => {
        try {
            return new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
            return d.date;
        }
    });

    const revenueData = {
        labels: revenueLabels.length > 0 ? revenueLabels : ['No Data'],
        datasets: [
            {
                label: 'Revenue',
                data: validTrends.length > 0 ? validTrends.map(d => d.amount) : [0],
                borderColor: '#FF8C00',
                backgroundColor: 'rgba(255, 140, 0, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#FF8C00',
            },
        ],
    };

    // 2. Peak Hours (Bar Chart)
    const peakHoursData = {
        labels: ['6AM-8AM', '9AM-12PM', '12PM-3PM', '3PM-6PM', '6PM-9PM', '9PM-12AM'],
        datasets: [
            {
                label: 'Activity Volume',
                data: [8, 6, 7, 6, 2, 0], // Logic for this not yet implemented in backend, keeping Mock
                backgroundColor: (context) => {
                    if (!context.chart.ctx) return '#FF8C00';
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, '#FB923C');
                    gradient.addColorStop(1, '#FF8C00');
                    return gradient;
                },
                borderRadius: 8,
                barThickness: 40,
            },
        ],
    };

    // 3. Membership Distribution (Doughnut) - DYNAMIC
    const validDist = Array.isArray(membershipDist) ? membershipDist : [];
    const membershipData = {
        labels: validDist.length > 0 ? validDist.map(d => d.label) : ['No Data'],
        datasets: [
            {
                data: validDist.length > 0 ? validDist.map(d => d.count) : [1],
                backgroundColor: [
                    '#FF8C00', // Brand Orange
                    '#10B981', // System Emerald
                    '#EF4444',
                    '#F59E0B',
                    '#FFFFFF',
                    '#6B7280',
                    '#1F2937'
                ],
                borderWidth: 0,
                hoverOffset: 4,
            },
        ],
    };

    // 4. Revenue Sources (Doughnut) - NEW
    const validRevDist = Array.isArray(stats.revenueDistribution) ? stats.revenueDistribution : [];
    const revenueSourceData = {
        labels: validRevDist.map(d => d.label),
        datasets: [{
            data: validRevDist.map(d => d.value),
            backgroundColor: validRevDist.map(d => d.color),
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const commonOptions = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, grid: { color: '#252A33' }, ticks: { color: '#9CA3AF' } },
            x: { grid: { display: false }, ticks: { color: '#9CA3AF' } }
        }
    };

    const doughnutOptions = {
        plugins: {
            legend: {
                position: 'right',
                labels: { usePointStyle: true, boxWidth: 8, padding: 20, color: '#9CA3AF' }
            }
        }
    };

    const ProductRow = ({ rank, name, category, price, growth, imageColor }) => (
        <div className="flex items-center p-4 bg-surfaceHighlight border border-white/5 rounded-2xl mb-3 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-primary font-bold text-lg w-8">#{rank}</span>
            <div className={`w-12 h-12 rounded-xl ${imageColor} flex items-center justify-center text-white font-bold mr-4`}>
                {name.charAt(0)}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{name}</h4>
                    <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-medium">New</span>
                </div>
                <p className="text-xs text-text-muted">{category}</p>
            </div>
            <div className="text-right">
                <p className="font-bold text-white">{formatPrice(price)}</p>
                <p className="text-xs text-emerald-400">+{growth}% vs last month</p>
            </div>
        </div>
    );

    return (
        <div className="pb-10 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
                    <p className="text-text-muted mt-1">Deep insights into gym performance</p>
                </div>
<<<<<<< HEAD
                <div className="flex gap-4">
                    {/* Toggle Buttons */}
                    <div className="bg-surfaceHighlight p-1 rounded-xl flex border border-white/10">
                        <button
                            onClick={() => setViewMode('daily')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'daily' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-white'}`}
                        >
                            Daily
                        </button>
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'monthly' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-white'}`}
                        >
                            Monthly
                        </button>
                    </div>

                    <div className="relative hidden md:block">
                        <input
                            type="text"
                            placeholder="Search"
                            className="pl-10 pr-4 py-2 bg-surfaceHighlight border border-white/10 rounded-xl text-sm focus:ring-primary focus:border-primary w-64 text-white placeholder-text-muted h-full"
                        />
                        <span className="material-icons-round absolute left-3 top-2.5 text-text-muted text-lg">search</span>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Total Expenses {displayData.label}</p>
                    <h2 className="text-3xl font-bold text-red-500 mt-2">{formatPrice(displayData.expenses)}</h2>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Net Profit {displayData.label}</p>
                    <h2 className={`text-3xl font-bold mt-2 ${displayData.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatPrice(displayData.profit)}
                    </h2>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Total Revenue {displayData.label}</p>
                    <h2 className="text-3xl font-bold text-white mt-2">{formatPrice(displayData.revenue)}</h2>
=======
                {/* Date Filter */}
                <div className="flex items-center gap-2 bg-surface p-2 rounded-xl border border-white/10">
                    <span className="text-text-muted text-sm pl-2">Range:</span>
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-primary outline-none"
                    />
                    <span className="text-text-muted">-</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-primary outline-none"
                    />
>>>>>>> 5d624b7d422135ad0a5d3556806a69ae2c59ae62
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Total Expenses (Period)</p>
                    <h2 className="text-3xl font-bold text-red-400 mt-2">{formatPrice(stats.periodExpenses)}</h2>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Net Profit (Period)</p>
                    <h2 className={`text-3xl font-bold mt-2 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPrice(netProfit)}
                    </h2>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Total Revenue (Period)</p>
                    <h2 className="text-3xl font-bold text-white mt-2">{formatPrice(stats.periodRevenue)}</h2>
                </div>
            </div>

            {/* Detailed Earnings Breakdown (New) */}
            <h3 className="text-xl font-bold text-white mt-4 mb-2">Detailed Earnings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Shop Revenue Card */}
                <div className="bg-surfaceHighlight p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <span className="material-icons-round text-6xl text-primary">storefront</span>
                    </div>
                    <p className="text-text-muted text-sm font-medium uppercase tracking-wider">Total Shop Sales</p>
                    <h2 className="text-2xl font-bold text-white mt-2">{formatPrice(stats.breakdown?.shopRevenue || 0)}</h2>

                    <div className="flex items-center gap-4 mt-2 text-xs border-t border-white/5 pt-2">
                        <div>
                            <span className="text-text-muted block">Store (App)</span>
                            <span className="text-white font-medium">{formatPrice(stats.breakdown?.storeRevenue || 0)}</span>
                        </div>
                        <div className="h-4 w-px bg-white/10"></div>
                        <div>
                            <span className="text-text-muted block">POS (Counter)</span>
                            <span className="text-white font-medium">{formatPrice(stats.breakdown?.posRevenue || 0)}</span>
                        </div>
                    </div>
                </div>

                {/* Training Earnings Card */}
                <div className="bg-surfaceHighlight p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <span className="material-icons-round text-6xl text-emerald-400">fitness_center</span>
                    </div>
                    <p className="text-text-muted text-sm font-medium uppercase tracking-wider">Net Training Earnings</p>
                    <div className="flex items-end gap-2 mt-2">
                        <h2 className="text-2xl font-bold text-emerald-400">
                            {formatPrice(stats.breakdown?.trainingNet || 0)}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs border-t border-white/5 pt-2">
                        <div>
                            <span className="text-text-muted block">Gross Revenue</span>
                            <span className="text-white font-medium">{formatPrice(stats.breakdown?.trainingRevenue || 0)}</span>
                        </div>
                        <div className="h-4 w-px bg-white/10"></div>
                        <div>
                            <span className="text-text-muted block">Costs (Comm. & Mat.)</span>
                            <span className="text-red-400 font-medium">-{formatPrice(stats.breakdown?.trainingExpenses || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Breakdown (Summary & Modal Trigger) */}
            <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Revenue Breakdown</h3>
                    <p className="text-sm text-text-muted">
                        {transactions.length} transactions found for {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
                    </p>
                </div>
                <button
                    onClick={() => setShowBreakdownModal(true)}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-colors font-medium border border-white/10"
                >
                    <span className="material-icons-round">list_alt</span>
                    View Details
                </button>
            </div>

            {/* Revenue Breakdown Modal */}
            {showBreakdownModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col animate-scale-up">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-surfaceHighlight rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-white">Detailed Revenue Breakdown</h2>
                                <p className="text-sm text-text-muted">{new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setShowBreakdownModal(false)} className="text-text-muted hover:text-white transition-colors">
                                <span className="material-icons-round text-2xl">close</span>
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1">
                            {loadingTx ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
                                </div>
                            ) : transactions.length === 0 ? (
                                <div className="text-center text-text-muted p-12">
                                    <span className="material-icons-round text-4xl mb-2 opacity-50">receipt_long</span>
                                    <p>No transactions found for this period.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-surfaceHighlight z-10 shadow-sm">
                                        <tr className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                            <th className="p-4 pl-6">Date/Time</th>
                                            <th className="p-4">Type</th>
                                            <th className="p-4">Member</th>
                                            <th className="p-4">Staff</th>
                                            <th className="p-4">Method</th>
                                            <th className="p-4 text-right pr-6">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {transactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-4 pl-6 text-sm text-white">
                                                    {new Date(tx.date).toLocaleDateString()}
                                                    <span className="text-text-muted ml-2 text-xs">
                                                        {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-white group-hover:bg-white/10 transition-colors">
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-text-secondary">
                                                    {tx.member ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">
                                                                {tx.member.firstName[0]}
                                                            </div>
                                                            {tx.member.firstName} {tx.member.lastName}
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-text-muted">Guest / Walk-in</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-xs text-text-muted">
                                                    {tx.cashier?.name || 'Unknown'}
                                                </td>
                                                <td className="p-4 text-sm text-text-muted">{tx.method}</td>
                                                <td className="p-4 pr-6 text-right font-bold text-emerald-400">
                                                    {formatPrice(tx.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-surfaceHighlight rounded-b-2xl flex justify-between items-center">
                            <span className="text-text-muted text-sm">Total Records: {transactions.length}</span>
                            <div className="text-emerald-400 font-bold bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20">
                                Total Revenue: {formatPrice(transactions.reduce((acc, curr) => acc + curr.amount, 0))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Row: Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Revenue Trends */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Revenue Trends</h3>
                    <div className="h-64">
                        <Line data={revenueData} options={commonOptions} />
                    </div>
                </div>

                {/* Peak Hours */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Peak Hours Analysis</h3>
                    <div className="h-64">
                        <Bar data={peakHoursData} options={commonOptions} />
                    </div>
                </div>
            </div>

            {/* Middle Row: Breakdown Charts */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue Sources (New) */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm flex flex-col items-center justify-center">
                    <div className="w-full text-left mb-2">
                        <h3 className="text-lg font-bold text-white">Revenue Sources</h3>
                    </div>
                    <div className="w-64 h-64 relative">
                        <Doughnut data={revenueSourceData} options={doughnutOptions} />
                    </div>
                </div>

                {/* Membership Dist */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm flex flex-col items-center justify-center">
                    <div className="w-full text-left mb-2">
                        <h3 className="text-lg font-bold text-white">Membership Distribution</h3>
                    </div>
                    <div className="w-64 h-64 relative">
                        <Doughnut data={membershipData} options={doughnutOptions} />
                    </div>
                </div>
            </div>

<<<<<<< HEAD
                {/* Top Products */}
                <div className="lg:col-span-3 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-6">Top Performing Products</h3>
                    <div className="space-y-2">
                        <ProductRow rank="1" name="Whey Protein Isolate" category="Supplements" price={1230.00} growth="15" imageColor="bg-amber-600" />
                        <ProductRow rank="2" name="Pre-Workout Blue Raz" category="Supplements" price={945.50} growth="10" imageColor="bg-white/20" />
                        <ProductRow rank="3" name="Gym Shark Water Bottle" category="Merch" price={620.00} growth="20" imageColor="bg-zinc-800" />
                    </div>
=======
            {/* Bottom Row: Products */}
            <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                <h3 className="text-lg font-bold text-white mb-6">Top Performing Products</h3>
                <div className="space-y-2">
                    <ProductRow rank="1" name="Whey Protein Isolate" category="Supplements" price={1230.00} growth="15" imageColor="bg-amber-600" />
                    <ProductRow rank="2" name="Pre-Workout Blue Raz" category="Supplements" price={945.50} growth="10" imageColor="bg-white/20" />
                    <ProductRow rank="3" name="Gym Shark Water Bottle" category="Merch" price={620.00} growth="20" imageColor="bg-zinc-800" />
>>>>>>> 5d624b7d422135ad0a5d3556806a69ae2c59ae62
                </div>
            </div>
        </div>
    );
}
