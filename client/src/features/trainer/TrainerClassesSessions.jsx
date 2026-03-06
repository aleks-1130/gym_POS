import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const FINALIZED_SESSION_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'DECLINED'];

const toDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toDateString();
};

const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
};

const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatSelectedDay = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Selected Date';
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

export default function TrainerClassesSessions() {
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDay, setSelectedDay] = useState(() => new Date().toDateString());
    const [initializedSelection, setInitializedSelection] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [sessionsRes, classesRes] = await Promise.all([
                    axios.get('/api/trainer/me/sessions'),
                    axios.get('/api/trainer/me/classes')
                ]);
                setSessions(sessionsRes.data || []);
                setClasses(classesRes.data || []);
            } catch (e) {
                console.error('Failed to load trainer classes/sessions', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const upcomingSessions = useMemo(() => {
        const now = new Date();
        return [...sessions]
            .filter((session) => {
                const sessionDate = new Date(session.date);
                if (Number.isNaN(sessionDate.getTime()) || sessionDate < now) return false;
                const status = String(session.status || '').toUpperCase();
                return !FINALIZED_SESSION_STATUSES.includes(status);
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [sessions]);

    const classEvents = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return [...classes]
            .filter((cls) => {
                const sessionDate = new Date(cls.sessionDate);
                return !Number.isNaN(sessionDate.getTime()) && sessionDate >= startOfToday;
            })
            .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));
    }, [classes]);

    const eventsByDay = useMemo(() => {
        const map = {};

        upcomingSessions.forEach((session) => {
            const key = toDateKey(session.date);
            if (!key) return;
            map[key] = map[key] || [];
            map[key].push({
                id: `session-${session.id}`,
                type: 'SESSION',
                date: new Date(session.date),
                title: `${session.member?.firstName || ''} ${session.member?.lastName || ''}`.trim() || `Member #${session.memberId}`,
                status: session.status,
                duration: session.duration
            });
        });

        classEvents.forEach((cls) => {
            const key = toDateKey(cls.sessionDate);
            if (!key) return;
            map[key] = map[key] || [];
            map[key].push({
                id: `class-${cls.id}`,
                type: 'CLASS',
                date: new Date(cls.sessionDate),
                title: cls.name || `Class #${cls.id}`,
                enrolled: Number(cls.enrolled || 0),
                capacity: Number(cls.capacity || 0)
            });
        });

        Object.keys(map).forEach((key) => {
            map[key].sort((a, b) => a.date - b.date);
        });

        return map;
    }, [upcomingSessions, classEvents]);

    const eventDayKeys = useMemo(() => {
        return Object.keys(eventsByDay).sort((a, b) => new Date(a) - new Date(b));
    }, [eventsByDay]);

    useEffect(() => {
        if (initializedSelection) return;
        const todayKey = new Date().toDateString();
        if (eventDayKeys.includes(todayKey)) {
            setSelectedDay(todayKey);
        } else if (eventDayKeys.length > 0) {
            setSelectedDay(eventDayKeys[0]);
        }
        setInitializedSelection(true);
    }, [eventDayKeys, initializedSelection]);

    const selectedSessions = useMemo(() => {
        return upcomingSessions.filter((session) => toDateKey(session.date) === selectedDay);
    }, [upcomingSessions, selectedDay]);

    const selectedClasses = useMemo(() => {
        return classEvents.filter((cls) => toDateKey(cls.sessionDate) === selectedDay);
    }, [classEvents, selectedDay]);

    const monthYearLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const endOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const leadingDays = startOfMonth.getDay();
    const totalCells = leadingDays + endOfMonth.getDate();
    const rows = Math.ceil(totalCells / 7);
    const firstCellDate = new Date(startOfMonth);
    firstCellDate.setDate(firstCellDate.getDate() - leadingDays);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">Classes & Sessions</h1>
                <p className="text-text-muted mt-1">One calendar view for your 1-on-1 sessions and class schedules</p>
            </header>

            <section className="space-y-4">
                <div className="flex items-center justify-between bg-surface rounded-2xl border border-white/5 p-4">
                    <button
                        onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                        className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10"
                    >
                        Prev
                    </button>
                    <p className="text-white font-semibold">{monthYearLabel}</p>
                    <button
                        onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                        className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10"
                    >
                        Next
                    </button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-text-muted">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        <span>1-on-1 Session</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>Class</span>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-xs text-text-muted font-bold uppercase tracking-wider px-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel) => (
                        <div key={dayLabel} className="text-center">{dayLabel}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: rows * 7 }).map((_, idx) => {
                        const day = new Date(firstCellDate);
                        day.setDate(firstCellDate.getDate() + idx);
                        const dayKey = day.toDateString();
                        const dayEvents = eventsByDay[dayKey] || [];
                        const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                        const isToday = new Date().toDateString() === dayKey;
                        const isSelected = selectedDay === dayKey;

                        return (
                            <button
                                key={`${dayKey}-${idx}`}
                                type="button"
                                onClick={() => setSelectedDay(dayKey)}
                                className={`min-h-[116px] rounded-xl border p-2 flex flex-col gap-2 text-left transition-colors ${isCurrentMonth ? 'bg-surface border-white/5' : 'bg-white/5 border-white/5 opacity-50'} ${isToday ? 'ring-1 ring-primary/30' : ''} ${isSelected ? 'border-primary/30 bg-primary/5' : ''}`}
                            >
                                <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
                                    <span>{day.getDate()}</span>
                                    {dayEvents.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                                            {dayEvents.length}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                    {dayEvents.slice(0, 3).map((event) => (
                                        <div
                                            key={event.id}
                                            className={`rounded-lg px-2 py-1 text-[10px] border ${event.type === 'SESSION' ? 'bg-primary/10 border-primary/25 text-primary' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'}`}
                                        >
                                            <p className="font-semibold truncate">
                                                {formatTime(event.date)} {event.type === 'SESSION' ? '1:1' : 'Class'}
                                            </p>
                                            <p className="truncate text-white/80">{event.title}</p>
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[10px] text-text-muted">{dayEvents.length - 3} more</div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Schedule Details</h2>
                    <p className="text-xs text-text-muted">{formatSelectedDay(selectedDay)}</p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">1-on-1 Sessions</h3>
                        <span className="text-xs text-text-muted">{selectedSessions.length} item{selectedSessions.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="overflow-x-auto bg-surface border border-white/5 rounded-2xl">
                        <table className="w-full min-w-[680px] text-sm">
                            <thead className="bg-white/5">
                                <tr className="text-left text-text-muted">
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">Time</th>
                                    <th className="px-4 py-3 font-semibold">Member</th>
                                    <th className="px-4 py-3 font-semibold">Duration</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedSessions.length === 0 ? (
                                    <tr>
                                        <td className="px-4 py-4 text-text-muted" colSpan={5}>No 1-on-1 sessions on this day.</td>
                                    </tr>
                                ) : (
                                    selectedSessions.map((session) => (
                                        <tr key={session.id} className="border-t border-white/5">
                                            <td className="px-4 py-3 text-white">{formatDate(session.date)}</td>
                                            <td className="px-4 py-3 text-white">{formatTime(session.date)}</td>
                                            <td className="px-4 py-3 text-white">{`${session.member?.firstName || ''} ${session.member?.lastName || ''}`.trim() || `Member #${session.memberId}`}</td>
                                            <td className="px-4 py-3 text-white">{Number(session.duration || 0)} min</td>
                                            <td className="px-4 py-3 text-text-muted uppercase tracking-wide">{session.status || 'SCHEDULED'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Classes</h3>
                        <span className="text-xs text-text-muted">{selectedClasses.length} item{selectedClasses.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="overflow-x-auto bg-surface border border-white/5 rounded-2xl">
                        <table className="w-full min-w-[680px] text-sm">
                            <thead className="bg-white/5">
                                <tr className="text-left text-text-muted">
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">Time</th>
                                    <th className="px-4 py-3 font-semibold">Class</th>
                                    <th className="px-4 py-3 font-semibold">Enrolled</th>
                                    <th className="px-4 py-3 font-semibold">Capacity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedClasses.length === 0 ? (
                                    <tr>
                                        <td className="px-4 py-4 text-text-muted" colSpan={5}>No classes on this day.</td>
                                    </tr>
                                ) : (
                                    selectedClasses.map((cls) => (
                                        <tr key={cls.id} className="border-t border-white/5">
                                            <td className="px-4 py-3 text-white">{formatDate(cls.sessionDate)}</td>
                                            <td className="px-4 py-3 text-white">{formatTime(cls.sessionDate)}</td>
                                            <td className="px-4 py-3 text-white">{cls.name}</td>
                                            <td className="px-4 py-3 text-white">{Number(cls.enrolled || 0)}</td>
                                            <td className="px-4 py-3 text-white">{Number(cls.capacity || 0)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
