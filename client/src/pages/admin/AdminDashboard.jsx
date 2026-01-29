import React from 'react';
import { Line } from 'react-chartjs-2';
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
} from 'chart.js';

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

const AdminDashboard = ({ stats }) => {
    // Fallback data if stats are missing or loading error
    const data = stats || { activeMembers: 0, revenueToday: 0, expiringSoon: 0 };

    // Mock chart data for now (backend only returns total numbers, not time-series yet in the specific endpoint analyzed)
    // To fix this properly later, backend endpoint /stats needs to return specific chart data arrays.
    // using static dummy chart data for visual consistency.
    const revenueChartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Weekly Revenue',
                data: [1200, 1900, 300, 500, 200, 3000, 4500],
                borderColor: '#FF8C00',
                backgroundColor: 'rgba(255, 140, 0, 0.2)',
                tension: 0.4,
                fill: true,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#9CA3AF' } },
            y: { grid: { color: '#252A33' }, ticks: { color: '#9CA3AF' } },
        },
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Revenue (Today)" value={`$${data.revenueToday}`} icon="payments" trend={12.5} />
                <StatCard title="Active Members" value={data.activeMembers} icon="group" trend={-2.4} />
                <StatCard title="Expiring Soon (7 Days)" value={data.expiringSoon} icon="warning" isAlert />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-6">Revenue Trends</h3>
                    <div className="h-80 w-full">
                        <Line data={revenueChartData} options={chartOptions} />
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-6">Recent Activity</h3>
                    {/* Static activity for Admin Demo */}
                    <div className="space-y-1">
                        <ActivityItem user="Alex Trainer" action="scheduled a new class" time="2m ago" />
                        <ActivityItem user="Sarah Connor" action="checked in" time="15m ago" />
                        <ActivityItem user="Bruce Wayne" action="renewed membership" time="1h ago" />
                    </div>
                </div>
            </div>
        </>
    );
};

// Internal Sub-components
const StatCard = ({ title, value, icon, trend, isAlert }) => (
    <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm flex items-center justify-between">
        <div>
            <p className="text-text-muted text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
            {trend && (
                <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className="material-icons-round text-[14px]">{trend > 0 ? 'trending_up' : 'trending_down'}</span>
                    {Math.abs(trend)}% vs last week
                </p>
            )}
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAlert ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
            <span className="material-icons-round text-2xl">{icon}</span>
        </div>
    </div>
);

const ActivityItem = ({ user, action, time }) => (
    <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 p-2 rounded-xl transition-colors">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-secondary font-bold text-xs">{user.charAt(0)}</div>
        <div className="flex-1">
            <p className="text-sm font-medium text-white">{user} <span className="text-text-muted font-normal">{action}</span></p>
        </div>
        <span className="text-xs text-text-muted">{time}</span>
    </div>
);

export default AdminDashboard;
