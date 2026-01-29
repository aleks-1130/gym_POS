import React from 'react';
import { useAuth } from '../context/AuthContext';
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

export default function Dashboard() {
    const { user } = useAuth();

    // Mock Data for Visuals
    const revenueData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Weekly Revenue',
                data: [1200, 1900, 300, 500, 200, 3000, 4500],
                borderColor: '#FF8C00', // Orange
                backgroundColor: 'rgba(255, 140, 0, 0.2)',
                tension: 0.4,
                fill: true,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#9CA3AF' } },
            y: { grid: { color: '#252A33' }, ticks: { color: '#9CA3AF' } },
        },
    };

    const StatCard = ({ title, value, icon, trend }) => (
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
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
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

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-text-muted mt-1">Welcome back, {user?.name || 'User'}</p>
                </div>
                <div className="flex gap-4">
                    <button className="px-4 py-2 bg-surfaceHighlight border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                        Download Report
                    </button>
                    <button className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                        Add Member
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value="$45,231" icon="payments" trend={12.5} />
                <StatCard title="Active Members" value="1,204" icon="group" trend={-2.4} />
                <StatCard title="Check-ins Today" value="142" icon="transfer_within_a_station" trend={5.8} />
                <StatCard title="Pending Tasks" value="5" icon="assignment" />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white">Revenue Trends</h3>
                        <select className="bg-surfaceHighlight border-none text-text-muted text-sm rounded-lg focus:ring-0 cursor-pointer hover:bg-white/10">
                            <option>This Week</option>
                            <option>Last Week</option>
                        </select>
                    </div>
                    <div className="h-80 w-full">
                        <Line data={revenueData} options={chartOptions} />
                    </div>
                </div>

                {/* Right Panel - Activity */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-6">Recent Activity</h3>
                    <div className="space-y-1">
                        <ActivityItem user="Alex Trainer" action="scheduled a new class" time="2m ago" />
                        <ActivityItem user="Sarah Connor" action="checked in" time="15m ago" />
                        <ActivityItem user="Bruce Wayne" action="renewed membership" time="1h ago" />
                        <ActivityItem user="Clark Kent" action="purchased Protein Shake" time="2h ago" />
                        <ActivityItem user="Diana Prince" action="updated profile" time="3h ago" />
                    </div>
                    <button className="w-full mt-6 py-3 text-primary font-medium text-sm hover:bg-primary/10 rounded-xl transition-colors">
                        View All Activity
                    </button>
                </div>
            </div>
        </div>
    );
}
