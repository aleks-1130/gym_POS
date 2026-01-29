import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
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

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // In a real app, you might want to use a configured axios instance with interceptors for the token
                // Assuming global axios defaults or headers setup elsewhere, or adding manual header here:
                const token = sessionStorage.getItem('token') || localStorage.getItem('token'); // Simplistic token retrieval
                if (!token) return;

                const res = await axios.get('http://localhost:5000/api/dashboard/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div className="text-white p-8">Loading Dashboard...</div>;

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-text-muted mt-1">Welcome back, {user?.name || 'User'}</p>
                </div>
                {/* Only Admin/Staff typically need these quick actions */}
                {user.role !== 'MEMBER' && (
                    <div className="flex gap-4">
                        <button className="px-4 py-2 bg-surfaceHighlight border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                            Download Report
                        </button>
                        <button className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                            Add Member
                        </button>
                    </div>
                )}
            </header>

            {user.role === 'MEMBER' ? (
                <MemberDashboard stats={stats} user={user} />
            ) : (
                <AdminDashboard stats={stats} />
            )}
        </div>
    );
}

// --- Sub-Components ---

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

const MemberDashboard = ({ stats, user }) => {
    // stats.memberData contains the full member record including plan
    const member = stats?.memberData || {};
    const planName = member.plan?.name || "No Active Plan";
    const expiryDate = member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : "N/A";
    const isExpired = member.expiryDate && new Date(member.expiryDate) < new Date();

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Member specific cards */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
                    <p className="text-text-muted text-sm font-medium mb-1">Current Plan</p>
                    <h3 className="text-2xl font-bold text-white">{planName}</h3>
                    <p className={`text-sm mt-2 font-medium ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isExpired ? 'Expired' : 'Active'}
                    </p>
                </div>

                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-text-muted text-sm font-medium mb-1">Expires On</p>
                            <h3 className="text-2xl font-bold text-white">{expiryDate}</h3>
                        </div>
                        <span className="material-icons-round text-primary bg-primary/10 p-2 rounded-xl">event</span>
                    </div>
                    {isExpired && (
                        <button className="mt-4 w-full py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-colors">
                            Renew Now
                        </button>
                    )}
                </div>

                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-text-muted text-sm font-medium mb-1">Loyalty Points</p>
                            <h3 className="text-2xl font-bold text-white">{member.points || 0} pts</h3>
                        </div>
                        <span className="material-icons-round text-yellow-500 bg-yellow-500/10 p-2 rounded-xl">star</span>
                    </div>
                    <p className="text-xs text-text-muted mt-2">Redeem for rewards</p>
                </div>
            </div>

            {/* Member Quick Actions / Info */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-surface p-8 rounded-3xl border border-white/5 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                        <span className="material-icons-round text-3xl">qr_code_2</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Digital Member Pass</h3>
                    <p className="text-text-muted text-sm mb-6">Scan this code at the front desk to check in.</p>
                    <div className="bg-white p-4 rounded-xl inline-block">
                        {/* Placeholder QR */}
                        <div className="w-32 h-32 bg-black opacity-10 flex items-center justify-center text-xs">QR Code</div>
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-3xl border border-white/5 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-white mb-4">Messages</h3>
                    <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 mb-4">
                        <div className="flex gap-3">
                            <span className="material-icons-round text-primary">campaign</span>
                            <div>
                                <h4 className="font-bold text-primary text-sm">Welcome to FitOS!</h4>
                                <p className="text-xs text-white/80 mt-1">We are glad to have you. Check out our latest classes.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Shared Components ---

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

