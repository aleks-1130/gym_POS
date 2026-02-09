import React from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useCurrency } from '../../context/CurrencyContext';
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
    const { formatPrice, rate } = useCurrency(); // Get rate
    const [stats, setStats] = React.useState({
        revenue: 0,
        monthlyRevenue: 0,
        expenses: 0,
    });

    React.useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('http://localhost:5000/api/dashboard/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setStats({
                    revenue: data.revenueToday || 0,
                    monthlyRevenue: data.monthlyRevenue || 0,
                    expenses: data.totalExpenses || 0
                });
            } catch (e) {
                console.error("Failed to fetch stats", e);
            }
        };
        fetchStats();
    }, []);

    // Calculate Net Profit (USD)
    const netProfit = stats.monthlyRevenue - stats.expenses;

    // --- Mock Data ---

    // 1. Revenue Trends (Line Chart)
    const revenueData = {
        labels: ['Sun', 'Sat', 'Mon', 'Fri', 'Thu', 'Wed'],
        datasets: [
            {
                label: 'Weekly Revenue',
                data: [50, 200, 80, 50, 100, 1100],
                borderColor: '#FF8C00', // Orange
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
                data: [8, 6, 7, 6, 2, 0],
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, '#FB923C'); // Orange 400
                    gradient.addColorStop(1, '#FF8C00'); // Orange 500
                    return gradient;
                },
                borderRadius: 8,
                barThickness: 40,
            },
        ],
    };

    // 3. Membership Distribution (Doughnut)
    const membershipData = {
        labels: ['Platinum Yearly', 'Gold Monthly', 'Silver Weekly'],
        datasets: [
            {
                data: [35, 45, 20],
                backgroundColor: [
                    '#FF8C00', // Orange Pro
                    '#FB923C', // Orange Light
                    '#6B7280', // Gray
                ],
                borderWidth: 0,
                hoverOffset: 4,
            },
        ],
    };

    // Chart Configuration
    const commonOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#252A33' },
                ticks: { color: '#9CA3AF' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#9CA3AF' }
            }
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

    // Product Component
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
        <div className="pb-10">
            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
                    <p className="text-text-muted mt-1">Deep insights into gym performance</p>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search"
                        className="pl-10 pr-4 py-2 bg-surfaceHighlight border border-white/10 rounded-xl text-sm focus:ring-primary focus:border-primary w-64 text-white placeholder-text-muted"
                    />
                    <span className="material-icons-round absolute left-3 top-2 text-text-muted text-lg">search</span>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Total Expenses (MTD)</p>
                    <h2 className="text-3xl font-bold text-red-500 mt-2">{formatPrice(stats.expenses)}</h2>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Net Profit (MTD)</p>
                    <h2 className={`text-3xl font-bold mt-2 ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatPrice(netProfit)}
                    </h2>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm">
                    <p className="text-text-muted text-sm font-medium">Total Revenue (MTD)</p>
                    <h2 className="text-3xl font-bold text-white mt-2">{formatPrice(stats.monthlyRevenue)}</h2>
                </div>
            </div>

            {/* Top Row: Charts */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue Trends */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Revenue Trends</h3>
                    <div className="h-64">
                        <Line data={revenueData} options={commonOptions} />
                    </div>
                    <div className="flex justify-center mt-2">
                        <div className="flex items-center text-xs text-text-muted">
                            <span className="w-8 h-1 bg-primary/50 inline-block mr-2 rounded-full"></span>
                            Weekly Revenue
                        </div>
                    </div>
                </div>

                {/* Peak Hours */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Peak Hours Analysis</h3>
                    <div className="h-64">
                        <Bar data={peakHoursData} options={commonOptions} />
                    </div>
                    <div className="flex justify-center mt-2">
                        <div className="flex items-center text-xs text-text-muted">
                            <span className="w-3 h-3 bg-secondary inline-block mr-2 rounded-sm"></span>
                            Activity Volume
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid lg:grid-cols-5 gap-6">
                {/* Membership Dist */}
                <div className="lg:col-span-2 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm flex flex-col items-center justify-center">
                    <div className="w-full text-left mb-2">
                        <h3 className="text-lg font-bold text-white">Membership Distribution</h3>
                    </div>
                    <div className="w-64 h-64 relative">
                        <Doughnut data={membershipData} options={doughnutOptions} />
                    </div>
                </div>

                {/* Top Products */}
                <div className="lg:col-span-3 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-6">Top Performing Products</h3>
                    <div className="space-y-2">
                        <ProductRow rank="1" name="Whey Protein Isolate" category="Supplements" price={1230.00} growth="15" imageColor="bg-amber-600" />
                        <ProductRow rank="2" name="Pre-Workout Blue Raz" category="Supplements" price={945.50} growth="10" imageColor="bg-white/20" />
                        <ProductRow rank="3" name="Gym Shark Water Bottle" category="Merch" price={620.00} growth="20" imageColor="bg-zinc-800" />
                    </div>
                </div>
            </div>
        </div>
    );
}
