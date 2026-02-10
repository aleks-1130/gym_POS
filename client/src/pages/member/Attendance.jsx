import React, { useMemo, useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import axios from 'axios';

const monthLabel = (date) =>
    date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const startOfWeek = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const toISODate = (date) => date.toISOString().slice(0, 10);

export default function Attendance() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/access/logs');
                setLogs(res.data || []);
            } catch {
                console.error('Failed to fetch logs');
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const checkInDays = useMemo(() => {
        const allowed = logs.filter((log) => log.status === 'ALLOWED');
        return new Set(allowed.map((log) => toISODate(new Date(log.checkIn))));
    }, [logs]);

    const monthDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth));
        const end = endOfMonth(currentMonth);
        const days = [];
        let cursor = start;
        while (cursor <= end || cursor.getDay() !== 0) {
            days.push(new Date(cursor));
            cursor = addDays(cursor, 1);
        }
        return days;
    }, [currentMonth]);

    const today = new Date();
    const todayKey = toISODate(today);

    const stats = useMemo(() => {
        const total = logs.filter((log) => log.status === 'ALLOWED').length;
        const currentMonthIndex = currentMonth.getMonth();
        const currentYear = currentMonth.getFullYear();
        const monthCount = logs.filter((log) => {
            if (log.status !== 'ALLOWED') return false;
            const date = new Date(log.checkIn);
            return date.getMonth() === currentMonthIndex && date.getFullYear() === currentYear;
        }).length;
        const lastVisit = logs.length ? new Date(logs[0].checkIn) : null;
        return { total, monthCount, lastVisit };
    }, [logs, currentMonth]);

    if (loading) return <div className="text-white p-6 text-center">Loading attendance...</div>;

    return (
        <div className="pb-24 px-4 sm:px-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Attendance Calendar</h1>
                <p className="text-text-muted text-xs sm:text-sm mt-1">Green = checked in, Red = missed</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 text-center">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Total Check-ins</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">{stats.total}</p>
                </div>
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 text-center">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">This Month</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-400">{stats.monthCount}</p>
                </div>
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 text-center col-span-2 sm:col-span-1">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Last Visited</p>
                    <p className="text-xs sm:text-sm font-bold text-yellow-400">
                        {stats.lastVisit ? stats.lastVisit.toLocaleDateString() : 'Never'}
                    </p>
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <button
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-text-muted hover:text-white"
                        onClick={() => setCurrentMonth((prev) => startOfMonth(new Date(prev.getFullYear(), prev.getMonth() - 1, 1)))}
                    >
                        Prev
                    </button>
                    <h2 className="text-white font-semibold">{monthLabel(currentMonth)}</h2>
                    <button
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-text-muted hover:text-white"
                        onClick={() => setCurrentMonth((prev) => startOfMonth(new Date(prev.getFullYear(), prev.getMonth() + 1, 1)))}
                    >
                        Next
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-xs text-text-muted">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div key={d} className="text-center font-semibold">
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {monthDays.map((day) => {
                        const dayKey = toISODate(day);
                        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                        const isToday = dayKey === todayKey;
                        const isPast = dayKey < todayKey;
                        const checkedIn = checkInDays.has(dayKey);
                        const missed = isPast && !checkedIn;

                        let statusClass = 'bg-white/5 text-text-muted';
                        let statusBadge = null;

                        if (checkedIn) {
                            statusClass = 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
                            statusBadge = <Check size={14} />;
                        } else if (missed) {
                            statusClass = 'bg-red-500/15 text-red-300 border border-red-500/30';
                            statusBadge = <X size={14} />;
                        } else {
                            statusClass = 'bg-white/5 text-text-muted border border-white/5';
                        }

                        return (
                            <div
                                key={dayKey}
                                className={`h-16 sm:h-20 rounded-xl border flex flex-col items-center justify-center gap-1 text-sm ${statusClass} ${
                                    !isCurrentMonth ? 'opacity-40' : ''
                                } ${isToday ? 'ring-2 ring-primary/50' : ''}`}
                            >
                                <div className="text-xs font-semibold">{day.getDate()}</div>
                                {statusBadge && <div className="text-base font-bold">{statusBadge}</div>}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500/60"></span>
                        Checked in
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500/60"></span>
                        Missed
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-white/20"></span>
                        Upcoming
                    </div>
                </div>
            </div>
        </div>
    );
}
