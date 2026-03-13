import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend } from 'chart.js';
import { useCurrency } from '../../context/CurrencyContext';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const StaffDashboard = ({ stats }) => {
    const { formatPrice } = useCurrency();
    const [data, setData] = useState(() => buildInitialState(stats));

    useEffect(() => {
        if (stats) {
            setData(prev => {
                const newState = buildInitialState(stats);
                if (JSON.stringify(prev) === JSON.stringify(newState)) return prev;
                return newState;
            });
        }
    }, [stats]);

    useEffect(() => {
        let isMounted = true;

        const fetchAll = async () => {
            try {
                
                const [logsRes, membersRes, paymentsRes, trainersRes] = await Promise.all([
                    axios.get('/api/access/logs'),
                    axios.get('/api/members'),
                    axios.get('/api/payments'),
                    axios.get('/api/trainers')
                ]);

                const logs = Array.isArray(logsRes.data) ? logsRes.data : [];
                const members = Array.isArray(membersRes.data) ? membersRes.data : [];
                const payments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
                const trainers = Array.isArray(trainersRes.data) ? trainersRes.data : [];

                const now = new Date();
                const weekRange = getWeekRange(now);

                const weeklyCheckins = buildWeeklyCheckins(logs, weekRange.start, weekRange.end);
                const recentActivities = logs.slice(0, 5);
                const recentTransactions = payments.slice(0, 5);
                const topMembers = [...members]
                    .sort((a, b) => (b.points || 0) - (a.points || 0))
                    .slice(0, 5);
                const activeMembers = members.filter(m => m.status === 'ACTIVE').length;
                const expiredMembers = members.filter(m => m.status === 'EXPIRED').length;
                const expiringSoon = members.filter(m => isExpiringSoon(m?.expiryDate, now)).length;
                const trainerCount = trainers.length;

                if (isMounted) {
                    setData({
                        activeMembers,
                        expiredMembers,
                        trainerCount,
                        expiringSoon,
                        weeklyCheckins,
                        recentTransactions,
                        topMembers,
                        recentActivities
                    });
                }
            } catch (e) {
                console.error('Failed to refresh staff dashboard', e);
            }
        };

        fetchAll();
        const interval = setInterval(fetchAll, 10000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const weekly = data.weeklyCheckins || { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], counts: [0, 0, 0, 0, 0, 0, 0] };
    const recentTransactions = data.recentTransactions || [];
    const topMembers = data.topMembers || [];
    const recentActivities = data.recentActivities || [];
    const trainerCount = data.trainerCount || 0;
    const expiredMembers = data.expiredMembers || 0;

    const chartData = {
        labels: weekly.labels,
        datasets: [
            {
                label: 'Check-ins',
                data: weekly.counts,
                backgroundColor: 'rgba(255, 140, 0, 0.35)',
                borderColor: '#FF8C00',
                borderWidth: 2,
                borderRadius: 10,
                maxBarThickness: 32
            },
        ] };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => items[0]?.label || '',
                    label: (item) => `${item.raw} check-ins` } } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#9CA3AF' } },
            y: {
                grid: { color: '#252A33' },
                ticks: { color: '#9CA3AF', precision: 0 },
                beginAtZero: true
            } } };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-3">
                    <StatCard title="Active Members" value={data.activeMembers} icon="group" />
                </div>
                <div className="lg:col-span-3">
                    <StatCard title="Expired Members" value={expiredMembers} icon="person_off" isAlert />
                </div>
                <div className="lg:col-span-3">
                    <StatCard title="Registered Trainers" value={trainerCount} icon="fitness_center" />
                </div>
                <div className="lg:col-span-3">
                    <StatCard title="Expiring Soon (7 Days)" value={data.expiringSoon} icon="warning" isAlert />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Session Tracker (Mon-Sun)</h3>
                        <span className="text-xs text-text-muted">Daily check-ins</span>
                    </div>
                    <div className="h-72 w-full">
                        <Bar data={chartData} options={chartOptions} />
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm h-full">
                        <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <QuickLink to="/payments" icon="receipt_long" label="Open POS" />
                            <QuickLink to="/members" icon="groups" label="Members" />
                            <QuickLink to="/access" icon="qr_code_scanner" label="Access" />
                            <QuickLink to="/classes" icon="event" label="Classes" />
                            <QuickLink to="/loyalty" icon="loyalty" label="Rewards" />
                            <QuickLink to="/announcements" icon="campaign" label="Announcements" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Top Members (Loyalty)</h3>
                    <div className="space-y-2">
                        {topMembers.length === 0 && (
                            <p className="text-sm text-text-muted">No members with points yet</p>
                        )}
                        {topMembers.map((member) => (
                            <div
                                key={member.id}
                                className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white/5 border border-white/5"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold">
                                        {getInitials(member)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{getMemberName(member)}</p>
                                        <p className="text-xs text-text-muted">Highest points</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">{member.points || 0}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">points</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-5 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>
                    <div className="space-y-2">
                        {recentTransactions.length === 0 && (
                            <p className="text-sm text-text-muted">No transactions yet</p>
                        )}
                        {recentTransactions.map((tx) => (
                            <div
                                key={tx.id}
                                className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white/5 border border-white/5"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                        {getInitials(tx.member)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">
                                            {tx.type || 'Payment'}
                                        </p>
                                        <p className="text-xs text-text-muted">
                                            {formatDateTime(tx.date)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">{formatPrice(tx.amount)}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">{tx.method || 'N/A'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-6">Recent Activity</h3>
                    <div className="space-y-1">
                        {recentActivities.length === 0 && (
                            <p className="text-sm text-text-muted">No recent activity yet</p>
                        )}
                        {recentActivities.map((activity) => (
                            <ActivityItem
                                key={activity.id}
                                name={getMemberName(activity.member)}
                                initials={getInitials(activity.member)}
                                action={formatAccessAction(activity)}
                                time={formatTimeAgo(activity.checkIn)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, isAlert }) => {
    const iconClass = isAlert ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary';

    return (
        <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm flex items-center justify-between hover:border-primary/20 transition-colors">
            <div>
                <p className="text-text-muted text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconClass}`}>
                <span className="material-icons-round text-2xl">{icon}</span>
            </div>
        </div>
    );
};

const QuickLink = ({ to, icon, label }) => (
    <a
        href={to}
        className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 transition-all flex items-center gap-3"
    >
        <span className="material-icons-round text-primary text-xl">{icon}</span>
        <span className="text-sm font-semibold text-white">{label}</span>
    </a>
);

const ActivityItem = ({ name, initials, action, time }) => (
    <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 p-2 rounded-xl transition-colors">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-secondary font-bold text-xs">{initials || 'NA'}</div>
        <div className="flex-1">
            <p className="text-sm font-medium text-white">
                {name} <span className="text-text-muted font-normal">{action}</span>
            </p>
        </div>
        <span className="text-xs text-text-muted">{time}</span>
    </div>
);

const buildInitialState = (stats) => ({
    activeMembers: stats?.activeMembers || 0,
    trainerCount: stats?.trainerCount || 0,
    expiredMembers: stats?.expiredMembers || 0,
    expiringSoon: stats?.expiringSoon || 0,
    weeklyCheckins: stats?.weeklyCheckins || null,
    recentTransactions: stats?.recentTransactions || [],
    topMembers: stats?.topMembers || [],
    recentActivities: stats?.recentActivities || []
});

const getWeekRange = (baseDate) => {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
};

const buildWeeklyCheckins = (logs, start, end) => {
    const counts = Array(7).fill(0);
    logs.forEach((log) => {
        if (!log?.checkIn || log?.status === 'DENIED') return;
        const date = new Date(log.checkIn);
        if (date < start || date >= end) return;
        const dayIndex = (date.getDay() + 6) % 7;
        counts[dayIndex] += 1;
    });
    return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], counts };
};

const isExpiringSoon = (expiryDate, now) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return expiry >= now && expiry <= end;
};

const getInitials = (member) => {
    if (!member) return 'NA';
    const first = member.firstName?.charAt(0) || '';
    const last = member.lastName?.charAt(0) || '';
    const initials = `${first}${last}`.toUpperCase();
    return initials || 'NA';
};

const getMemberName = (member) => {
    if (!member) return 'Guest';
    const first = member.firstName || '';
    const last = member.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || 'Guest';
};

const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatAccessAction = (activity) => {
    if (!activity) return 'checked in';
    if (activity.status === 'DENIED') return 'was denied access';
    return 'checked in';
};

const formatTimeAgo = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

export default StaffDashboard;
