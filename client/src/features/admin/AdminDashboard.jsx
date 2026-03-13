import React from 'react';
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
import { Line, Bar, Doughnut } from 'react-chartjs-2';

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

import ProfitLossChart from '../../components/dashboard/ProfitLossChart';
import ExpenseBreakdownChart from '../../components/dashboard/ExpenseBreakdownChart';
import LowStockWidget from '../../components/dashboard/LowStockWidget';
import RecentActivityWidget from '../../components/dashboard/RecentActivityWidget';

const AdminDashboard = ({ stats }) => {
    const { formatPrice } = useCurrency();
    // Fallback data if stats are missing or loading error
    const data = stats || { activeMembers: 0, revenueToday: 0, expiringSoon: 0, monthlyRevenue: 0, totalExpenses: 0 };

    // Calculate Net Profit on Frontend: Revenue (PHP) - Expenses (PHP)
    const netProfit = data.monthlyRevenue - data.totalExpenses;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#9CA3AF', padding: 10 } },
            y: { grid: { color: '#252A33' }, ticks: { color: '#9CA3AF' } } },
        layout: {
            padding: { bottom: 10 }
        }
    };

    // Dynamic Chart Data from API for Revenue Trend (Line Chart)
    const chartLabels = data.revenueTrend?.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const chartValues = data.revenueTrend?.map(item => item.revenue) || [0, 0, 0, 0, 0, 0, 0]; // Now item.revenue after backend change

    const revenueChartData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'Revenue',
                data: chartValues,
                borderColor: '#FF8C00',
                backgroundColor: 'rgba(255, 140, 0, 0.2)',
                tension: 0.4,
                fill: true },
        ] };

    // --- Render ---
    return (
        <div className="space-y-8 pb-10">

            {/* 1. Today Overview (Operational Snapshot) */}
            <section>
                <SectionHeader title="Today's Overview" subtitle="Operational Snapshot" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard
                        title="Today's Revenue"
                        value={formatPrice(data.revenueToday)}
                        icon="payments"
                        color="text-primary"
                    />
                    <StatCard
                        title="Today's Refunds"
                        value={`-${formatPrice(data.refundsToday || 0)}`}
                        icon="undo"
                        color="text-amber-400"
                    />
                    <StatCard
                        title="Today's Expenses"
                        value={formatPrice(data.expensesToday)}
                        icon="money_off"
                        color="text-red-400"
                    />
                    <StatCard
                        title="Net Profit (Today)"
                        value={formatPrice(data.netProfitToday)}
                        icon="monetization_on"
                        color={data.netProfitToday >= 0 ? "text-green-400" : "text-red-400"}
                    />
                    <StatCard
                        title="Transactions"
                        value={data.transactionsToday || 0}
                        icon="receipt_long"
                        color="text-blue-400"
                    />
                </div>
            </section>

            {/* 2. Monthly Profit & Loss (Business Health) */}
            <section>
                <SectionHeader title="Monthly Business Health" subtitle="Profit & Loss Overview" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <BusinessCard
                        title="Monthly Revenue"
                        value={formatPrice(data.monthlyRevenue)}
                        subtext="Total Incoming"
                        icon="account_balance_wallet"
                        color="bg-primary/10 text-primary border-primary/20"
                    />
                    <BusinessCard
                        title="Monthly Refunds"
                        value={`-${formatPrice(data.monthlyRefunds || 0)}`}
                        subtext="Returns & Voids"
                        icon="undo"
                        color="bg-amber-500/10 text-amber-400 border-amber-500/20"
                    />
                    <BusinessCard
                        title="Monthly Expenses"
                        value={formatPrice(data.totalExpenses)}
                        subtext="Total Outgoing"
                        icon="trending_down"
                        color="bg-red-500/10 text-red-400 border-red-500/20"
                    />
                    <BusinessCard
                        title="Monthly Net Profit"
                        value={formatPrice(netProfit)}
                        subtext="Realized Profit"
                        icon="savings"
                        color={netProfit >= 0 ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}
                    />
                </div>
            </section>

            {/* 3. Charts & Analytics Section (3 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Monthly Profit & Loss */}
                <div>
                    <ProfitLossChart data={data.revenueTrend} />
                </div>
                {/* 2. Revenue Trend */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 h-[380px]">
                    <SectionHeader title="Revenue Trend" subtitle="Daily Performance" />
                    <div className="h-[300px]">
                        <Line data={revenueChartData} options={chartOptions} />
                    </div>
                </div>
                {/* 3. Expense Breakdown */}
                <div>
                    <ExpenseBreakdownChart data={data.expenseBreakdown} />
                </div>
            </div>

            {/* 4. Bottom Widgets: Low Stock | Recent Activity | Quick Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Col 1: Low Stock */}
                <LowStockWidget count={data.lowStockCount} items={data.lowStockItems} />

                {/* Col 2: Recent Activity (Center) */}
                <RecentActivityWidget activity={data.recentActivity} />

                {/* Col 3: Quick Indicators */}
                <div className="space-y-4">
                    <SectionHeader title="Quick Indicators" subtitle="Attention Needed" />
                    <div className="grid grid-cols-1 gap-3">
                        <IndicatorCard
                            label="Active Members"
                            value={data.activeMembers}
                            icon="groups"
                            color="text-blue-400"
                        />
                        <IndicatorCard
                            label="Expiring Soon (7 Days)"
                            value={data.expiringSoon}
                            icon="update"
                            color="text-yellow-400"
                            alert={data.expiringSoon > 0}
                        />
                        <IndicatorCard
                            label="Pending Payments"
                            value={data.pendingPaymentsCount || 0}
                            icon="pending_actions"
                            color="text-red-400"
                            alert={data.pendingPaymentsCount > 0}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Helper Components ---

const SectionHeader = ({ title, subtitle }) => (
    <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-text-muted text-xs">{subtitle}</p>
    </div>
);

const StatCard = ({ title, value, icon, color = "text-white" }) => (
    <div className="bg-surface border border-white/5 p-5 rounded-2xl flex items-center justify-between hover:border-white/10 transition-all">
        <div>
            <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-1">{title}</p>
            <h4 className={`text-2xl font-bold ${color}`}>{value}</h4>
        </div>
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
            <span className="material-icons-round text-xl">{icon}</span>
        </div>
    </div>
);

const BusinessCard = ({ title, value, subtext, icon, color }) => (
    <div className={`p-6 rounded-2xl border flex flex-col justify-between h-32 ${color}`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</p>
                <h4 className="text-3xl font-bold mt-1">{value}</h4>
            </div>
            <span className="material-icons-round text-2xl opacity-60">{icon}</span>
        </div>
        <p className="text-xs font-medium opacity-70">{subtext}</p>
    </div>
);

const IndicatorCard = ({ label, value, icon, color, alert = false }) => (
    <div className={`bg-surface border p-4 rounded-xl flex items-center justify-between transition-all ${alert ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 hover:border-white/10'
        }`}>
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${color}`}>
                <span className="material-icons-round text-lg">{icon}</span>
            </div>
            <span className="text-white font-medium text-sm">{label}</span>
        </div>
        <span className={`text-lg font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</span>
    </div>
);

export default AdminDashboard;
