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
    const [membershipEndDate, setMembershipEndDate] = useState(null);
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
                const now = new Date();
                const membershipPeriods = Array.isArray(memberData?.membershipPeriods) ? memberData.membershipPeriods : [];
                const activePeriod = membershipPeriods.find((period) => {
                    const end = new Date(period?.endDate);
                    return !Number.isNaN(end.getTime()) && end >= now;
                }) || null;
                const latestPeriod = membershipPeriods[0] || null;
                const rawMembershipEnd = memberData?.expiryDate || activePeriod?.endDate || latestPeriod?.endDate || null;
                if (rawRegistration) {
                    const parsed = new Date(rawRegistration);
                    setRegistrationDate(Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed));
                } else {
                    setRegistrationDate(null);
                }
                if (rawMembershipEnd) {
                    const parsedEnd = new Date(rawMembershipEnd);
                    setMembershipEndDate(Number.isNaN(parsedEnd.getTime()) ? null : startOfDay(parsedEnd));
                } else {
                    setMembershipEndDate(null);
                }
            } else {
                setRegistrationDate(null);
                setMembershipEndDate(null);
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

    const registrationDayKey = useMemo(() => (registrationDate ? toDateKey(registrationDate) : ''), [registrationDate]);
    const membershipEndDayKey = useMemo(() => (membershipEndDate ? toDateKey(membershipEndDate) : ''), [membershipEndDate]);

    const monthYearLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const endOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const leadingDays = startOfMonth.getDay();
    const rows = Math.ceil((leadingDays + endOfMonth.getDate()) / 7);
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
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-300 font-bold">Checked-in Days</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Since membership start</p>
                    <p className="text-xl font-bold text-white mt-1">{membershipCheckInStats.checkIns}</p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-rose-300 font-bold">No Check-in Days</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Since membership start</p>
                    <p className="text-xl font-bold text-white mt-1">{membershipCheckInStats.missed}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-primary font-bold">Upcoming Bookings</p>
                    <p className="text-[10px] text-text-muted mt-0.5">1-on-1 sessions</p>
                    <p className="text-xl font-bold text-white mt-1">{upcomingBookingCount}</p>
                    <Link to="/trainer-booking" className="mt-2 inline-flex text-[11px] font-semibold text-primary hover:underline">View history</Link>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-cyan-300 font-bold">Upcoming Classes</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Joined class sessions</p>
                    <p className="text-xl font-bold text-white mt-1">{upcomingClassCount}</p>
                    <Link to="/schedule" className="mt-2 inline-flex text-[11px] font-semibold text-cyan-300 hover:underline">View history</Link>
                </div>
            </div>

            <section className="space-y-4">
                <div className="flex items-center justify-between bg-surface rounded-2xl border border-white/5 p-4">
                    <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10">Prev</button>
                    <p className="text-white font-semibold">{monthYearLabel}</p>
                    <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10">Next</button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-xs text-text-muted font-bold uppercase tracking-wider px-1">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="text-center">{day}</div>)}</div>
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: rows * 7 }).map((_, idx) => {
                        const day = new Date(firstCellDate);
                        day.setDate(firstCellDate.getDate() + idx);
                        const dayKey = day.toDateString();
                        const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                        const isToday = new Date().toDateString() === dayKey;
                        const isSelected = selectedDay === dayKey;
                        const hasCheckIn = attendedByDate.has(dayKey);
                        const isFuture = day > startOfDay(new Date());
                        const isRegistrationDay = Boolean(registrationDayKey) && dayKey === registrationDayKey;
                        const isMembershipEndDay = Boolean(membershipEndDayKey) && dayKey === membershipEndDayKey;
                        const beforeRegistration = Boolean(registrationDate) && day < registrationDate;
                        const isMissed = isCurrentMonth && !isFuture && !hasCheckIn && !beforeRegistration;

                        const tone = isCurrentMonth
                            ? (
                                isRegistrationDay
                                    ? 'bg-amber-500/15 border-amber-500/35'
                                    : hasCheckIn
                                        ? 'bg-emerald-500/12 border-emerald-500/35'
                                        : (isMissed ? 'bg-rose-500/12 border-rose-500/35' : 'bg-surface border-white/5')
                            )
                            : 'bg-white/5 border-white/5 opacity-50';

                        return (
                            <button
                                key={`${dayKey}-${idx}`}
                                type="button"
                                onClick={() => {
                                    setSelectedDay(dayKey);
                                    if (isRegistrationDay) {
                                        setCellModal({
                                            title: 'Registration Start Date',
                                            message: `You started your membership registration on ${formatDate(day)}.`
                                        });
                                        return;
                                    }
                                    if (isMembershipEndDay) {
                                        setCellModal({
                                            title: 'Membership End Date',
                                            message: `Your membership ends on ${formatDate(day)}.`
                                        });
                                        return;
                                    }
                                    if (hasCheckIn) {
                                        const firstCheckIn = checkInInfoByDate.get(dayKey);
                                        setCellModal({
                                            title: 'Check-in Recorded',
                                            message: `You checked in on ${formatDate(day)}${firstCheckIn ? ` at ${formatTime(firstCheckIn)}` : ''}.`
                                        });
                                    }
                                }}
                                className={`min-h-[62px] sm:min-h-[72px] rounded-xl border p-2 flex flex-col text-left transition-colors ${tone} ${isToday ? 'ring-1 ring-primary/40' : ''} ${isSelected ? 'border-primary/40' : ''}`}
                            >
                                <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
                                    <span>{day.getDate()}</span>
                                    {(upcomingSessionsByDay.get(dayKey) || upcomingClassesByDay.get(dayKey)) ? (
                                        <span className="px-1 py-0.5 rounded-full bg-white/10 text-[9px] text-white/80">
                                            {(upcomingSessionsByDay.get(dayKey) || 0) + (upcomingClassesByDay.get(dayKey) || 0)}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-auto flex items-center gap-1.5">
                                    {isRegistrationDay && <span className="w-2 h-2 rounded-full bg-amber-300"></span>}
                                    {isMembershipEndDay && <span className="w-2 h-2 rounded-full bg-violet-400"></span>}
                                    {upcomingSessionsByDay.get(dayKey) ? <span className="w-2 h-2 rounded-full bg-primary"></span> : null}
                                    {upcomingClassesByDay.get(dayKey) ? <span className="w-2 h-2 rounded-full bg-cyan-400"></span> : null}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-text-muted">
                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm border border-emerald-400/35 bg-emerald-500/15"></span>
                        <span>Checked In</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm border border-rose-400/35 bg-rose-500/15"></span>
                        <span>No Check-in</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                        <span>Registration Start</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                        <span>Membership End</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        <span>Bookings</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        <span>Classes</span>
                    </div>
                </div>

            </section>

            <section className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-surface p-4">
                    <p className="text-xs text-text-muted uppercase tracking-wide">Selected Date</p>
                    <h2 className="text-sm sm:text-base font-bold text-white">{formatSelectedDay(selectedDay)}</h2>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Bookings (1-on-1)</h3>
                        <span className="text-xs text-text-muted">{selectedUpcomingSessions.length}</span>
                    </div>
                    {selectedUpcomingSessions.length === 0 ? (
                        <p className="text-xs text-text-muted">No upcoming bookings for this date.</p>
                    ) : (
                        selectedUpcomingSessions.map((entry) => (
                            <div key={`booking-${entry.id}`} className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                                <p className="text-sm font-semibold text-primary">{formatTime(entry.date)}</p>
                                <p className="text-sm text-white mt-1">{entry?.trainer?.name || 'Trainer Session'}</p>
                                <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wide">{Number(entry?.duration || 0)} min - {entry.status}</p>
                            </div>
                        ))
                    )}
                    <Link to="/trainer-booking" className="inline-flex text-xs font-semibold text-primary hover:underline">Open bookings history</Link>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Classes</h3>
                        <span className="text-xs text-text-muted">{selectedUpcomingClasses.length}</span>
                    </div>
                    {selectedUpcomingClasses.length === 0 ? (
                        <p className="text-xs text-text-muted">No upcoming classes for this date.</p>
                    ) : (
                        selectedUpcomingClasses.map((entry) => (
                            <div key={`class-${entry.id}`} className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                                <p className="text-sm font-semibold text-emerald-300">{formatTime(entry.date)}</p>
                                <p className="text-sm text-white mt-1">{entry?.class?.name || 'Class Session'}</p>
                                <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wide">{entry?.class?.trainer?.name || 'Trainer'} - {entry.status}</p>
                            </div>
                        ))
                    )}
                    <Link to="/schedule" className="inline-flex text-xs font-semibold text-cyan-300 hover:underline">Open class history</Link>
                </div>
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
