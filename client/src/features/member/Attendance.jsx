import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import MemberPageHeader from './components/MemberPageHeader';

const UPCOMING_SESSION_STATUSES = ['SCHEDULED', 'RESCHEDULED'];
const UPCOMING_CLASS_STATUSES = ['CONFIRMED'];

const toDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toDateString();
};

const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatSelectedDay = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Selected Date';
    return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

const describeError = (result, fallbackLabel) => {
    const status = result?.reason?.response?.status;
    const message = result?.reason?.response?.data?.error || result?.reason?.message || 'Request failed';
    return status ? `${fallbackLabel} (HTTP ${status}): ${message}` : `${fallbackLabel}: ${message}`;
};

const startOfDay = (value) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export default function Attendance() {
    const [logs, setLogs] = useState([]);
    const [trainingSessions, setTrainingSessions] = useState([]);
    const [classBookings, setClassBookings] = useState([]);
    const [registrationDate, setRegistrationDate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadIssues, setLoadIssues] = useState([]);
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDay, setSelectedDay] = useState(() => new Date().toDateString());
    const [cellModal, setCellModal] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            
            
            const [logsResult, sessionsResult, classesResult, dashboardResult] = await Promise.allSettled([
                axios.get('/api/access/logs'),
                axios.get('/api/members/me/training-sessions'),
                axios.get('/api/members/me/class-bookings'),
                axios.get('/api/dashboard/stats')
            ]);

            const issues = [];
            if (logsResult.status === 'fulfilled') setLogs(Array.isArray(logsResult.value?.data) ? logsResult.value.data : []);
            else {
                setLogs([]);
                issues.push(describeError(logsResult, 'Could not load check-in logs'));
            }

            if (sessionsResult.status === 'fulfilled') setTrainingSessions(Array.isArray(sessionsResult.value?.data) ? sessionsResult.value.data : []);
            else {
                setTrainingSessions([]);
                issues.push(describeError(sessionsResult, 'Could not load 1-on-1 bookings'));
            }

            if (classesResult.status === 'fulfilled') setClassBookings(Array.isArray(classesResult.value?.data) ? classesResult.value.data : []);
            else {
                setClassBookings([]);
                issues.push(describeError(classesResult, 'Could not load class bookings'));
            }

            if (dashboardResult.status === 'fulfilled') {
                const memberData = dashboardResult.value?.data?.memberData;
                const rawRegistration = memberData?.startDate || memberData?.createdAt || null;
                if (rawRegistration) {
                    const parsed = new Date(rawRegistration);
                    setRegistrationDate(Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed));
                } else {
                    setRegistrationDate(null);
                }
            } else {
                setRegistrationDate(null);
                issues.push(describeError(dashboardResult, 'Could not load registration date'));
            }

            setLoadIssues(issues);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const checkInInfoByDate = useMemo(() => {
        const map = new Map();
        logs.forEach((log) => {
            if (String(log?.status || 'ALLOWED').toUpperCase() !== 'ALLOWED') return;
            const parsed = new Date(log?.checkIn);
            if (Number.isNaN(parsed.getTime())) return;
            if (registrationDate && startOfDay(parsed) < registrationDate) return;
            const key = toDateKey(parsed);
            if (!key) return;
            if (!map.has(key) || parsed < map.get(key)) {
                map.set(key, parsed);
            }
        });
        return map;
    }, [logs, registrationDate]);

    const attendedByDate = useMemo(() => new Set(checkInInfoByDate.keys()), [checkInInfoByDate]);

    const sessionEntries = useMemo(
        () => trainingSessions
            .map((session) => {
                const date = new Date(session?.date);
                if (Number.isNaN(date.getTime())) return null;
                return { ...session, date, normalizedStatus: String(session?.status || '').toUpperCase() };
            })
            .filter(Boolean)
            .sort((a, b) => a.date - b.date),
        [trainingSessions]
    );

    const classEntries = useMemo(
        () => classBookings
            .map((booking) => {
                const date = new Date(booking?.sessionDate || booking?.class?.oneTimeDate);
                if (Number.isNaN(date.getTime())) return null;
                return { ...booking, date, normalizedStatus: String(booking?.status || '').toUpperCase() };
            })
            .filter(Boolean)
            .sort((a, b) => a.date - b.date),
        [classBookings]
    );

    const upcomingSessionsByDay = useMemo(() => {
        const now = new Date();
        const map = new Map();
        sessionEntries
            .filter((entry) => UPCOMING_SESSION_STATUSES.includes(entry.normalizedStatus) && entry.date >= now)
            .forEach((entry) => {
                const key = toDateKey(entry.date);
                map.set(key, (map.get(key) || 0) + 1);
            });
        return map;
    }, [sessionEntries]);

    const upcomingClassesByDay = useMemo(() => {
        const now = new Date();
        const map = new Map();
        classEntries
            .filter((entry) => UPCOMING_CLASS_STATUSES.includes(entry.normalizedStatus) && entry.date >= now)
            .forEach((entry) => {
                const key = toDateKey(entry.date);
                map.set(key, (map.get(key) || 0) + 1);
            });
        return map;
    }, [classEntries]);

    const selectedUpcomingSessions = useMemo(
        () => sessionEntries.filter((entry) => UPCOMING_SESSION_STATUSES.includes(entry.normalizedStatus) && toDateKey(entry.date) === selectedDay),
        [sessionEntries, selectedDay]
    );
    const selectedUpcomingClasses = useMemo(
        () => classEntries.filter((entry) => UPCOMING_CLASS_STATUSES.includes(entry.normalizedStatus) && toDateKey(entry.date) === selectedDay),
        [classEntries, selectedDay]
    );

    const upcomingBookingCount = useMemo(
        () => sessionEntries.filter((entry) => UPCOMING_SESSION_STATUSES.includes(entry.normalizedStatus) && entry.date >= new Date()).length,
        [sessionEntries]
    );
    const upcomingClassCount = useMemo(
        () => classEntries.filter((entry) => UPCOMING_CLASS_STATUSES.includes(entry.normalizedStatus) && entry.date >= new Date()).length,
        [classEntries]
    );

    const membershipCheckInStats = useMemo(() => {
        const today = startOfDay(new Date());
        if (!registrationDate) {
            return { checkIns: attendedByDate.size, missed: 0 };
        }
        if (registrationDate > today) {
            return { checkIns: 0, missed: 0 };
        }

        let checkIns = 0;
        let missed = 0;
        const cursor = new Date(registrationDate);
        while (cursor <= today) {
            const key = toDateKey(cursor);
            if (attendedByDate.has(key)) checkIns += 1;
            else missed += 1;
            cursor.setDate(cursor.getDate() + 1);
        }
        return { checkIns, missed };
    }, [attendedByDate, registrationDate]);

    const monthYearLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const calendarCells = useMemo(() => {
        const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
        const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
        const leading = start.getDay();
        const cells = [];
        for (let i = 0; i < leading; i += 1) cells.push(null);
        for (let d = 1; d <= end.getDate(); d += 1) {
            cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d));
        }
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [monthCursor]);
    const todayStart = startOfDay(new Date());
    const todayKey = todayStart.toDateString();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <MemberPageHeader
                title="Attendance"
                subtitle="Check your check-ins and upcoming classes or bookings"
                icon="fact_check"
            />

            {loadIssues.length > 0 && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
                    <p className="text-amber-200 text-sm font-semibold mb-1.5">Some attendance data failed to load</p>
                    {loadIssues.map((issue) => <p key={issue} className="text-[11px] sm:text-xs text-amber-100/90">{issue}</p>)}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="member-card-soft border-emerald-500/25 bg-emerald-500/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-300 font-bold">Checked-in Days</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Since membership start</p>
                    <p className="text-xl font-bold text-white mt-1">{membershipCheckInStats.checkIns}</p>
                </div>
                <div className="member-card-soft border-rose-500/25 bg-rose-500/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-rose-300 font-bold">No Check-in Days</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Since membership start</p>
                    <p className="text-xl font-bold text-white mt-1">{membershipCheckInStats.missed}</p>
                </div>
                <div className="member-card-soft border-primary/25 bg-primary/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-primary font-bold">Upcoming Bookings</p>
                    <p className="text-[10px] text-text-muted mt-0.5">1-on-1 sessions</p>
                    <p className="text-xl font-bold text-white mt-1">{upcomingBookingCount}</p>
                    <Link to="/trainer-booking" className="mt-2 inline-flex text-[11px] font-semibold text-primary hover:underline">View history</Link>
                </div>
                <div className="member-card-soft border-cyan-500/25 bg-cyan-500/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-cyan-300 font-bold">Upcoming Classes</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Joined class sessions</p>
                    <p className="text-xl font-bold text-white mt-1">{upcomingClassCount}</p>
                    <Link to="/schedule" className="mt-2 inline-flex text-[11px] font-semibold text-cyan-300 hover:underline">View history</Link>
                </div>
            </div>

            <section className="space-y-4">
                <div className="member-card-subtle bg-[#233248]/85 backdrop-blur-md p-4 sm:p-5 shadow-2xl">
                    <div className="flex items-center justify-between mb-5">
                        <button
                            type="button"
                            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 border border-white/5"
                        >
                            <span className="material-icons-round">chevron_left</span>
                        </button>
                        <div className="text-center">
                            <p className="text-base sm:text-lg font-black text-white px-3">{monthYearLabel}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 border border-white/5"
                        >
                            <span className="material-icons-round">chevron_right</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1.5 mb-3 text-center">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                            <div key={`${day}-${idx}`} className="text-xs font-black text-white/40 uppercase tracking-widest">{day}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                        {calendarCells.map((day, idx) => {
                            if (!day) return <div key={`blank-${idx}`} className="aspect-square" />;

                            const dayKey = day.toDateString();
                            const bookingCount = upcomingSessionsByDay.get(dayKey) || 0;
                            const classCount = upcomingClassesByDay.get(dayKey) || 0;
                            const dayEventsTotal = bookingCount + classCount;
                            const isToday = todayKey === dayKey;
                            const isSelected = selectedDay === dayKey;
                            const hasCheckIn = attendedByDate.has(dayKey);
                            const isFuture = day > todayStart;
                            const beforeRegistration = Boolean(registrationDate) && day < registrationDate;
                            const isMissed = !isFuture && !hasCheckIn && !beforeRegistration;

                            return (
                                <button
                                    key={dayKey}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDay(dayKey);
                                        if (hasCheckIn) {
                                            const firstCheckIn = checkInInfoByDate.get(dayKey);
                                            setCellModal({
                                                title: 'Check-in Recorded',
                                                message: `You checked in on ${formatDate(day)}${firstCheckIn ? ` at ${formatTime(firstCheckIn)}` : ''}.`
                                            });
                                        }
                                    }}
                                    className={`aspect-square rounded-xl text-sm sm:text-base font-bold transition-all duration-300 relative group border ${
                                        isSelected
                                            ? 'bg-white text-background border-white shadow-lg shadow-white/20 scale-105 z-10'
                                            : isToday
                                                ? 'bg-white/10 text-white border-white/30'
                                                : beforeRegistration
                                                    ? 'text-white/20 cursor-not-allowed opacity-60 bg-white/[0.02] border-white/5'
                                                    : 'bg-white/5 text-white hover:bg-white/10 hover:border-white/20 border-white/10 shadow-sm'
                                    }`}
                                >
                                    <span className="absolute top-2 left-2">{day.getDate()}</span>
                                    {dayEventsTotal > 0 && (
                                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/15 flex items-center justify-center text-[9px] font-black text-white/60 border border-white/10">
                                            {dayEventsTotal}
                                        </span>
                                    )}
                                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                                        {hasCheckIn && !beforeRegistration && !isFuture ? (
                                            <span className="material-icons-round text-[12px] leading-none text-emerald-400">check_circle</span>
                                        ) : null}
                                        {isMissed ? (
                                            <span className="material-icons-round text-[12px] leading-none text-rose-400">cancel</span>
                                        ) : null}
                                        {bookingCount > 0 ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500/90 shadow-[0_0_4px_rgba(59,130,246,0.5)]" /> : null}
                                        {classCount > 0 ? <span className="w-1.5 h-1.5 rounded-full bg-blue-300/90 shadow-[0_0_4px_rgba(147,197,253,0.5)]" /> : null}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-text-muted">
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons-round text-[16px] leading-none text-emerald-400">check_circle</span>
                            <span>Check-in</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons-round text-[16px] leading-none text-rose-400">cancel</span>
                            <span>No Check-in</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons-round text-[16px] leading-none text-blue-400">fitness_center</span>
                            <span>Bookings</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons-round text-[16px] leading-none text-blue-300">groups</span>
                            <span>Classes</span>
                        </div>
                    </div>
                </div>

            </section>

            <section className="space-y-4">
                <div className="flex items-end justify-between gap-4 mb-2">
                    <div>
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-none mb-1.5">Agenda Timeline</p>
                        <h2 className="text-2xl font-black text-white leading-tight">{formatSelectedDay(selectedDay)}</h2>
                    </div>
                </div>

                {!(selectedUpcomingSessions.length > 0 || selectedUpcomingClasses.length > 0) ? (
                    <div className="member-card-soft backdrop-blur-md p-8 text-center shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                            <span className="material-icons-round text-3xl text-text-muted/40">event_busy</span>
                        </div>
                        <p className="text-sm text-text-muted font-medium">No sessions or classes scheduled for this day.</p>
                        <div className="mt-4 flex flex-col gap-2">
                            <Link to="/trainer-booking" className="text-[11px] font-bold text-primary uppercase tracking-widest hover:underline">Book a Session</Link>
                            <Link to="/schedule" className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest hover:underline">Join a Class</Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {selectedUpcomingSessions.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-primary/80">1-on-1 Sessions</h3>
                                    <span className="text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded-full border border-white/10">{selectedUpcomingSessions.length}</span>
                                </div>
                                <div className="grid gap-3">
                                    {selectedUpcomingSessions.map((entry) => (
                                        <div key={`booking-${entry.id}`} className="relative pl-6 pb-6 last:pb-0 group">
                                            <div className="absolute left-[11px] top-2 bottom-0 w-px bg-white/10 group-last:bg-transparent"></div>
                                            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/20 border-2 border-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] z-10"></div>
                                            
                                            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 transition-all hover:bg-white/10 shadow-lg ml-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-lg font-black text-primary leading-none">{formatTime(entry.date)}</p>
                                                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-text-muted">
                                                            {Number(entry.duration || 0)} min
                                                        </span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${entry.normalizedStatus === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-primary/10 border-primary/30 text-primary'}`}>
                                                        {entry.normalizedStatus.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="mt-3 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-text-muted shrink-0">
                                                        <span className="material-icons-round text-lg">fitness_center</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-white leading-tight">{entry?.trainer?.name || 'Trainer Session'}</p>
                                                        <p className="text-[10px] text-text-muted font-medium mt-0.5 uppercase tracking-wider">With Trainer</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-white/5 text-right">
                                                    <Link to="/trainer-booking" className="inline-flex text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">Manage Booking</Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedUpcomingClasses.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-cyan-400/80">Classes</h3>
                                    <span className="text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded-full border border-white/10">{selectedUpcomingClasses.length}</span>
                                </div>
                                <div className="grid gap-3">
                                    {selectedUpcomingClasses.map((entry) => (
                                        <div key={`class-${entry.id}`} className="relative pl-6 pb-6 last:pb-0 group">
                                            <div className="absolute left-[11px] top-2 bottom-0 w-px bg-white/10 group-last:bg-transparent"></div>
                                            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-cyan-400/20 border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] z-10"></div>
                                            
                                            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 transition-all hover:bg-white/10 shadow-lg ml-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-lg font-black text-cyan-400 leading-none">{formatTime(entry.date)}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${entry.normalizedStatus === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400'}`}>
                                                        {entry.normalizedStatus.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="mt-3 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-text-muted shrink-0">
                                                        <span className="material-icons-round text-lg">self_improvement</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-white leading-tight">{entry?.class?.name || 'Class Session'}</p>
                                                        <p className="text-[10px] text-text-muted font-medium mt-0.5 uppercase tracking-wider">{entry?.class?.trainer?.name || 'By Trainer'}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-white/5 text-right">
                                                    <Link to="/schedule" className="inline-flex text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors">Manage Attendance</Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {cellModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-white font-bold text-base">{cellModal.title}</h3>
                                <p className="text-text-muted text-sm mt-1">{cellModal.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCellModal(null)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                                aria-label="Close modal"
                            >
                                <span className="material-icons-round text-base">close</span>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCellModal(null)}
                            className="mt-4 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-black hover:brightness-110"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
