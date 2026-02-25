import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function Attendance() {
    const [logs, setLogs] = useState([]);
    const [trainingSessions, setTrainingSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
            const [logsRes, sessionsRes] = await Promise.all([
                axios.get('/api/access/logs', { headers }),
                axios.get('/api/members/me/training-sessions', { headers })
            ]);
            setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
            setTrainingSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
        } catch {
            console.error("Failed to fetch attendance or training sessions");
        } finally {
            setLoading(false);
        }
    };

    const attendedByDate = useMemo(() => {
        const map = new Map();
        for (const log of logs) {
            if (log.status && log.status !== 'ALLOWED') continue;
            const dt = new Date(log.checkIn);
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            if (!map.has(key) || dt < map.get(key)) {
                map.set(key, dt);
            }
        }
        return map;
    }, [logs]);

    const monthLabel = useMemo(
        () => monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        [monthCursor]
    );

    const totalCheckIns = useMemo(
        () => logs.filter((log) => !log.status || log.status === 'ALLOWED').length,
        [logs]
    );

    const bookingsByDate = useMemo(() => {
        const map = new Map();
        for (const session of trainingSessions) {
            if (session?.status === 'CANCELLED') continue;
            const dt = new Date(session?.date);
            if (Number.isNaN(dt.getTime())) continue;
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            map.set(key, (map.get(key) || 0) + 1);
        }
        return map;
    }, [trainingSessions]);


    const calendarDays = useMemo(() => {
        const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
        const endOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
        const startOffset = startOfMonth.getDay();
        const totalDays = endOfMonth.getDate();
        const cells = [];

        for (let i = 0; i < startOffset; i += 1) {
            cells.push(null);
        }

        for (let day = 1; day <= totalDays; day += 1) {
            cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
        }

        while (cells.length % 7 !== 0) {
            cells.push(null);
        }

        return cells;
    }, [monthCursor]);

    if (loading) return <div className="text-white p-6 text-center">Loading attendance...</div>;

    return (
        <div className="space-y-5 sm:space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Attendance Calendar</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">Check mark = timed in, cross = missed day, bell = booked training</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                        className="h-9 w-9 rounded-lg border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                        aria-label="Previous month"
                    >
                        <span className="material-icons-round text-base">chevron_left</span>
                    </button>
                    <button
                        onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                        className="h-9 w-9 rounded-lg border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                        aria-label="Next month"
                    >
                        <span className="material-icons-round text-base">chevron_right</span>
                    </button>
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-3 mb-4">
                    <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                        <p className="text-xs uppercase tracking-wide text-text-muted font-semibold">Total Check-ins</p>
                        <p className="text-2xl font-bold text-primary mt-1">{totalCheckIns}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-semibold">{monthLabel}</p>
                </div>
                <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] sm:text-xs text-text-muted font-bold uppercase">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
                        <div key={dayName}>{dayName}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day, index) => {
                        if (!day) {
                            return <div key={`blank-${index}`} className="h-20 sm:h-24 rounded-xl bg-white/[0.02]" />;
                        }

                        const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const checkInDate = attendedByDate.get(dayKey);
                        const bookingCount = bookingsByDate.get(dayKey) || 0;
                        const hasBooking = bookingCount > 0;
                        const today = new Date();
                        const isFuture = day > new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const isMissed = !checkInDate && !isFuture;

                        return (
                            <div
                                key={dayKey}
                                className={`h-20 sm:h-24 rounded-xl border p-2 flex flex-col ${
                                    checkInDate
                                        ? 'border-emerald-500/20 bg-emerald-500/10'
                                        : isMissed
                                            ? 'border-red-500/20 bg-red-500/10'
                                            : 'border-white/10 bg-white/[0.02]'
                                }`}
                            >
                                <p className="text-xs sm:text-sm font-bold text-white">{day.getDate()}</p>
                                <div className="flex-1 flex items-center justify-center">
                                    {checkInDate && (
                                        <div className="inline-flex items-center text-emerald-400 font-semibold">
                                            <span className="material-icons-round text-base sm:text-lg">check</span>
                                        </div>
                                    )}
                                    {isMissed && (
                                        <div className="inline-flex items-center text-red-400 font-semibold">
                                            <span className="material-icons-round text-base sm:text-lg">close</span>
                                        </div>
                                    )}
                                    {!checkInDate && !isMissed && hasBooking && (
                                        <div className="inline-flex items-center text-amber-300 font-semibold">
                                            <span className="material-icons-round text-base sm:text-lg">notifications_active</span>
                                        </div>
                                    )}
                                </div>
                                {hasBooking && (
                                    <p className="text-[10px] sm:text-[11px] text-amber-300 font-semibold leading-tight text-center">
                                        {bookingCount} booking{bookingCount > 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
