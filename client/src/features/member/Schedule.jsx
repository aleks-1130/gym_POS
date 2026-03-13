import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { withApiBase } from '../../config/api';
import { useConfirm } from '../../context/ConfirmContext';

const parseTimeToMinutes = (timeValue) => {
    const raw = String(timeValue || '').trim().toUpperCase();
    if (!raw) return null;

    const hhmm24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (hhmm24) return (Number(hhmm24[1]) * 60) + Number(hhmm24[2]);

    const hhmm12 = raw.match(/^(0?\d|1[0-2]):([0-5]\d)\s*(AM|PM)$/);
    if (!hhmm12) return null;

    let hours = Number(hhmm12[1]) % 12;
    const minutes = Number(hhmm12[2]);
    if (hhmm12[3] === 'PM') hours += 12;
    return (hours * 60) + minutes;
};

const minutesTo12Hour = (minutes) => {
    const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = ((hour24 + 11) % 12) + 1;
    return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const getClassTimeRange = (time, duration) => {
    const startMinutes = parseTimeToMinutes(time);
    const durationMinutes = Number(duration);
    if (startMinutes === null || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return {
            start: String(time || 'TBA'),
            end: '',
            label: String(time || 'TBA')
        };
    }
    const endMinutes = startMinutes + durationMinutes;
    return {
        start: minutesTo12Hour(startMinutes),
        end: minutesTo12Hour(endMinutes),
        label: `${minutesTo12Hour(startMinutes)} - ${minutesTo12Hour(endMinutes)}`
    };
};

const formatDateLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

const formatTimeLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const getClassSessionDate = (cls) => {
    const rawValue = cls?.sessionDate || cls?.oneTimeDate;
    if (!rawValue) return null;
    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeClassHistoryStatus = (entry, now) => {
    const rawStatus = String(entry?.status || '').toUpperCase();
    const date = new Date(entry?.sessionDate || entry?.class?.oneTimeDate);
    const isFuture = !Number.isNaN(date.getTime()) && date >= now;

    if (rawStatus === 'CANCELLED' || rawStatus === 'DECLINED') return 'CANCELLED';
    if (rawStatus === 'NO_SHOW' || rawStatus === 'MISSED') return 'MISSED';
    if (rawStatus === 'ATTENDED' || rawStatus === 'COMPLETED') return 'COMPLETED';
    if (rawStatus === 'CONFIRMED' && isFuture) return 'UPCOMING';
    if (rawStatus === 'CONFIRMED' && !isFuture) return 'MISSED';
    return rawStatus || 'UNKNOWN';
};

const toHistoryStatusLabel = (status) => {
    if (status === 'COMPLETED') return 'Completed';
    if (status === 'MISSED') return 'Missed';
    if (status === 'CANCELLED') return 'Cancelled';
    return 'Unknown';
};

const toHistoryStatusClass = (status) => {
    if (status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (status === 'MISSED') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (status === 'CANCELLED') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-white/10 text-text-muted border-white/20';
};

const fallbackClassImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%230f172a'/%3E%3Cstop offset='1' stop-color='%231e293b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='480' height='480' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='22'%3EClass Image Unavailable%3C/text%3E%3C/svg%3E";

const handleClassImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackClassImage;
};

export default function Schedule() {
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const sessionPolicyNote = 'Joining a class consumes 1 session. If you leave later, that session is still consumed and not refunded.';
    const [classes, setClasses] = useState([]);
    const [sessionInfo, setSessionInfo] = useState({
        classSessionsRemaining: 0,
        classSessionsUsed: 0,
        canBookClasses: false
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('schedule'); // schedule | my-classes | history
    const [filter, setFilter] = useState('all');
    const [showClassFilters, setShowClassFilters] = useState(false);
    const [classSearch, setClassSearch] = useState('');
    const [selectedDay, setSelectedDay] = useState(null);
    const [classHistory, setClassHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [historyFilter, setHistoryFilter] = useState('all');

    const fetchClasses = useCallback(async () => {
        try {
            const res = await axios.get(withApiBase('/api/members/classes'), {
                params: { _t: Date.now() }
            });
            setClasses(res.data?.classes || []);
            setSessionInfo(res.data?.sessionInfo || {
                classSessionsRemaining: 0,
                classSessionsUsed: 0,
                canBookClasses: false
            });
        } catch (error) {
            console.error('Failed to fetch classes', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchClassHistory = useCallback(async () => {
        setHistoryLoading(true);
        setHistoryError('');
        try {
            const res = await axios.get(withApiBase('/api/members/me/class-bookings'), {
                params: { _t: Date.now() }
            });
            setClassHistory(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            const status = error?.response?.status;
            const message = error?.response?.data?.error || error?.message || 'Failed to fetch class history';
            setHistoryError(status ? `${message} (HTTP ${status})` : message);
            setClassHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClasses();
        fetchClassHistory();
    }, [fetchClasses, fetchClassHistory]);

    useEffect(() => {
        const handleFocus = () => {
            fetchClasses();
            fetchClassHistory();
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchClasses();
                fetchClassHistory();
            }
        };

        const intervalId = setInterval(() => {
            fetchClasses();
            fetchClassHistory();
        }, 15000);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchClasses, fetchClassHistory]);

    const handleBook = async (classId, sessionDate) => {
        const confirmed = await showConfirm({
            title: 'Session Policy',
            message: `${sessionPolicyNote} Continue joining this class?`,
            confirmLabel: 'Join Class'
        });
        if (!confirmed) return;

        try {
            await axios.post(withApiBase('/api/members/book'), { classId, sessionDate });
            await showAlert({ title: 'Joined!', message: 'Joined class successfully!', type: 'success' });
            fetchClasses();
            fetchClassHistory();
        } catch (error) {
            await showAlert({ title: 'Booking Failed', message: error.response?.data?.error || 'Booking failed', type: 'danger' });
        }
    };

    const handleCancel = async (classId, sessionDate) => {
        const policyConfirmed = await showConfirm({
            title: 'Leave Class?',
            message: 'Leaving this class will NOT refund your session. Your session remains consumed.',
            confirmLabel: 'I Understand',
            type: 'danger'
        });
        if (!policyConfirmed) return;

        const finalConfirmed = await showConfirm({
            title: 'Final Confirmation',
            message: 'Are you sure you want to leave this class?',
            confirmLabel: 'Leave Anyway',
            type: 'danger'
        });
        if (!finalConfirmed) return;

        try {
            await axios.post(withApiBase('/api/members/cancel-booking'), { classId, sessionDate });
            await showAlert({ title: 'Left Class', message: 'You left the class. Your session is still counted as used.', type: 'success' });
            fetchClasses();
            fetchClassHistory();
        } catch (error) {
            await showAlert({ title: 'Cancel Failed', message: error.response?.data?.error || 'Failed to cancel', type: 'danger' });
        }
    };

    const filteredClasses = useMemo(() => {
        const searchQuery = classSearch.trim().toLowerCase();
        const base = classes.filter((cls) => {
            if (cls.isBooked) return false;
            if (filter === 'available' && cls.enrolled >= cls.capacity) return false;
            if (searchQuery) {
                const searchableText = [
                    cls?.name,
                    cls?.trainer?.name,
                    cls?.dayOfWeek,
                    cls?.scheduleType,
                    cls?.oneTimeDate,
                    cls?.sessionDate
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!searchableText.includes(searchQuery)) return false;
            }

            if (selectedDay) {
                const dayMapping = {
                    M: ['Mon', 'Monday'],
                    T: ['Tue', 'Tuesday'],
                    W: ['Wed', 'Wednesday'],
                    TH: ['Thu', 'Thursday'],
                    F: ['Fri', 'Friday'],
                    S: ['Sat', 'Saturday'],
                    SUN: ['Sun', 'Sunday']
                };
                const matchDays = dayMapping[selectedDay];
                if (!matchDays?.some((day) => cls.dayOfWeek?.includes(day))) return false;
            }

            return true;
        });

        return [...base].sort((a, b) => {
            const fullDelta = Number((a.enrolled >= a.capacity)) - Number((b.enrolled >= b.capacity));
            if (fullDelta !== 0) return fullDelta;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
    }, [classes, filter, classSearch, selectedDay]);

    const filteredJoinedClasses = useMemo(() => {
        const searchQuery = classSearch.trim().toLowerCase();
        const base = classes.filter((cls) => {
            if (!cls.isBooked) return false;

            if (searchQuery) {
                const searchableText = [
                    cls?.name,
                    cls?.trainer?.name,
                    cls?.dayOfWeek,
                    cls?.scheduleType,
                    cls?.oneTimeDate,
                    cls?.sessionDate
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!searchableText.includes(searchQuery)) return false;
            }

            if (selectedDay) {
                const dayMapping = {
                    M: ['Mon', 'Monday'],
                    T: ['Tue', 'Tuesday'],
                    W: ['Wed', 'Wednesday'],
                    TH: ['Thu', 'Thursday'],
                    F: ['Fri', 'Friday'],
                    S: ['Sat', 'Saturday'],
                    SUN: ['Sun', 'Sunday']
                };
                const matchDays = dayMapping[selectedDay];
                if (!matchDays?.some((day) => cls.dayOfWeek?.includes(day))) return false;
            }

            return true;
        });

        return [...base].sort((a, b) => {
            const dateA = getClassSessionDate(a);
            const dateB = getClassSessionDate(b);
            if (dateA && dateB) return dateA - dateB;
            if (dateA) return -1;
            if (dateB) return 1;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
    }, [classes, classSearch, selectedDay]);

    const joinedClasses = useMemo(
        () => classes.filter((cls) => Boolean(cls?.isBooked)),
        [classes]
    );

    const nextJoinedClass = useMemo(() => {
        const sorted = [...joinedClasses].sort((a, b) => {
            const dateA = getClassSessionDate(a);
            const dateB = getClassSessionDate(b);
            if (dateA && dateB) return dateA - dateB;
            if (dateA) return -1;
            if (dateB) return 1;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
        return sorted[0] || null;
    }, [joinedClasses]);

    const historyEntries = useMemo(() => {
        const now = new Date();
        return classHistory
            .map((entry) => {
                const date = new Date(entry?.sessionDate || entry?.class?.oneTimeDate);
                if (Number.isNaN(date.getTime())) return null;
                return {
                    ...entry,
                    date,
                    normalizedHistoryStatus: normalizeClassHistoryStatus(entry, now)
                };
            })
            .filter((entry) => entry && entry.date < now)
            .sort((a, b) => b.date - a.date);
    }, [classHistory]);

    const filteredHistoryEntries = useMemo(() => {
        if (historyFilter === 'all') return historyEntries;
        if (historyFilter === 'completed') return historyEntries.filter((entry) => entry.normalizedHistoryStatus === 'COMPLETED');
        if (historyFilter === 'missed') return historyEntries.filter((entry) => entry.normalizedHistoryStatus === 'MISSED');
        if (historyFilter === 'cancelled') return historyEntries.filter((entry) => entry.normalizedHistoryStatus === 'CANCELLED');
        return historyEntries;
    }, [historyEntries, historyFilter]);
    const historyStatusCounts = useMemo(() => ({
        completed: historyEntries.filter((entry) => entry.normalizedHistoryStatus === 'COMPLETED').length,
        missed: historyEntries.filter((entry) => entry.normalizedHistoryStatus === 'MISSED').length,
        cancelled: historyEntries.filter((entry) => entry.normalizedHistoryStatus === 'CANCELLED').length
    }), [historyEntries]);

    const dayButtons = [
        { value: 'M', label: 'M' },
        { value: 'T', label: 'T' },
        { value: 'W', label: 'W' },
        { value: 'TH', label: 'TH' },
        { value: 'F', label: 'F' },
        { value: 'S', label: 'S' },
        { value: 'SUN', label: 'SUN' }
    ];
    const visibleClasses = activeTab === 'my-classes' ? filteredJoinedClasses : filteredClasses;

    const showSessionPolicy = async () => {
        await showAlert({
            title: 'Class Session Policy',
            message: sessionPolicyNote,
            type: 'info'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading schedule...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 px-4 max-w-5xl mx-auto space-y-4 sm:space-y-5">
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-4 space-y-3 border-b border-white/5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-white">
                            {activeTab === 'history'
                                ? 'Class History'
                                : activeTab === 'my-classes'
                                    ? 'Joined Classes'
                                    : 'Classes'}
                        </h1>
                        <p className="text-text-muted text-xs mt-0.5">
                            {activeTab === 'history'
                                ? 'Track your completed, missed, and cancelled past classes'
                                : activeTab === 'my-classes'
                                    ? 'View classes you joined and manage upcoming sessions'
                                    : 'Browse and join available classes'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={showSessionPolicy}
                        className="shrink-0 h-9 w-9 rounded-lg border border-white/10 bg-surface text-text-secondary hover:text-white hover:bg-white/5"
                        aria-label="View class session policy"
                        title="Session policy"
                    >
                        <span className="material-icons-round text-base">info</span>
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-2xl p-1 bg-surface/80 border border-white/10 shadow-inner">
                    <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'schedule'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">calendar_month</span>
                        Classes
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('my-classes')}
                        className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'my-classes'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">check_circle</span>
                        Joined
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'history'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">history</span>
                        <span>History</span>
                    </button>
                </div>

                {activeTab === 'history' && (
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'completed', label: 'Done' },
                            { value: 'missed', label: 'Missed' },
                            { value: 'cancelled', label: 'Cancelled' }
                        ].map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setHistoryFilter(item.value)}
                                className={`px-2 py-2 rounded-lg text-[11px] font-semibold border transition-all ${historyFilter === item.value
                                    ? 'bg-white text-black border-white shadow-sm'
                                    : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {activeTab !== 'history' ? (
                <>
                    <div className="space-y-3">
                        {activeTab === 'schedule' ? (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={`w-full rounded-xl px-3 py-2.5 text-xs font-bold border ${sessionInfo.classSessionsRemaining > 0
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                        : 'border-red-500/30 bg-red-500/10 text-red-300'
                                        }`}>
                                        <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-90">
                                            <span className="material-icons-round text-sm">event_available</span>
                                            Sessions Left
                                        </p>
                                        <p className="mt-1 text-lg font-extrabold">{sessionInfo.classSessionsRemaining}</p>
                                    </div>
                                    <div className="w-full rounded-xl px-3 py-2.5 border border-red-500/30 bg-red-500/10 text-red-300">
                                        <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-red-200">
                                            <span className="material-icons-round text-sm">history</span>
                                            Sessions Used
                                        </p>
                                        <p className="mt-1 text-lg font-extrabold text-red-300">{sessionInfo.classSessionsUsed}</p>
                                    </div>
                                </div>
                                {sessionInfo.classSessionsRemaining <= 0 && (
                                    <p className="text-xs text-red-400">No class sessions left. Buy a class session package at the front desk to join again.</p>
                                )}
                            </>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="w-full rounded-xl px-3 py-2.5 border border-primary/30 bg-primary/10 text-primary">
                                    <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                                        <span className="material-icons-round text-sm">check_circle</span>
                                        Joined Classes
                                    </p>
                                    <p className="mt-1 text-lg font-extrabold text-white">{joinedClasses.length}</p>
                                </div>
                                <div className="w-full rounded-xl px-3 py-2.5 border border-white/15 bg-white/5 text-text-secondary">
                                    <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-text-muted">
                                        <span className="material-icons-round text-sm">upcoming</span>
                                        Next Class
                                    </p>
                                    {nextJoinedClass ? (
                                        <>
                                            <p className="mt-1 text-sm font-bold text-white line-clamp-1">{nextJoinedClass.name || 'Joined Class'}</p>
                                            <p className="text-[11px] text-text-muted mt-0.5">
                                                {nextJoinedClass.dayOfWeek || formatDateLabel(nextJoinedClass.oneTimeDate || nextJoinedClass.sessionDate)}
                                                {' \u00b7 '}
                                                {getClassTimeRange(nextJoinedClass.time, nextJoinedClass.duration).start}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-1 text-sm font-bold text-text-muted">No joined classes yet</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <label className="relative flex-1">
                                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-sm text-text-muted">search</span>
                                <input
                                    type="text"
                                    value={classSearch}
                                    onChange={(event) => setClassSearch(event.target.value)}
                                    placeholder={activeTab === 'my-classes' ? 'Search joined classes' : 'Search classes'}
                                    className="h-8 w-full rounded-lg border border-white/10 bg-surface pl-8 pr-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                            </label>
                            {activeTab === 'schedule' && (
                                <button
                                    type="button"
                                    onClick={() => setShowClassFilters((prev) => !prev)}
                                    className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${showClassFilters || filter !== 'all'
                                        ? 'bg-white text-black border-white'
                                        : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    <span className="material-icons-round text-sm">tune</span>
                                    Filter
                                </button>
                            )}
                        </div>
                        {activeTab === 'schedule' ? (
                            <>
                                <p className="text-[11px] text-text-muted">
                                    {filter === 'available' ? 'Filter: Available classes' : 'Showing all classes. Use Available to hide full classes.'}
                                </p>
                                {showClassFilters && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'all', label: 'All Classes', icon: 'grid_view' },
                                            { value: 'available', label: 'Available', icon: 'event_available' }
                                        ].map((f) => (
                                            <button
                                                key={f.value}
                                                type="button"
                                                onClick={() => setFilter(f.value)}
                                                className={`px-2.5 py-2 rounded-lg font-bold text-[11px] transition-all border flex items-center justify-center gap-1 ${filter === f.value
                                                    ? 'bg-white text-black shadow-sm border-white'
                                                    : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                                    }`}
                                            >
                                                <span className="material-icons-round text-sm">{f.icon}</span>
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-[11px] text-text-muted">Showing only classes you already joined.</p>
                        )}

                        <div className="grid grid-cols-7 gap-2">
                            {dayButtons.map((day) => (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => setSelectedDay(selectedDay === day.value ? null : day.value)}
                                    className={`w-full h-9 rounded-lg font-bold text-[10px] sm:text-xs transition-all active:scale-95 ${selectedDay === day.value
                                        ? 'bg-primary text-background shadow-lg'
                                        : 'bg-surface text-text-muted hover:text-white border border-white/5'
                                        }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {visibleClasses.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <span className="material-icons-round text-3xl text-text-muted">event_busy</span>
                                </div>
                                <p className="text-text-muted text-sm">{activeTab === 'my-classes' ? 'No joined classes found' : 'No classes found'}</p>
                            </div>
                        ) : (
                            visibleClasses.map((cls) => {
                                const isFull = cls.enrolled >= cls.capacity;
                                const capacityPercent = (cls.enrolled / cls.capacity) * 100;
                                const noSessionsLeft = sessionInfo.classSessionsRemaining <= 0;
                                const cannotJoin = isFull || noSessionsLeft;
                                const classTime = getClassTimeRange(cls.time, cls.duration);
                                const scheduleType = String(cls.scheduleType || 'RECURRING').toUpperCase();

                                return (
                                    <div
                                        key={cls.id}
                                        className={`bg-surface rounded-xl p-4 border transition-all ${cls.isBooked
                                            ? 'border-primary/30 bg-primary/5'
                                            : 'border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                                    {cls.imageUrl ? (
                                                        <img src={cls.imageUrl} alt={cls.name} onError={handleClassImageError} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                            <span className="material-icons-round text-2xl">fitness_center</span>
                                                        </div>
                                                    )}
                                                    {cls.isBooked && (
                                                        <span className="absolute bottom-1 left-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-background">
                                                            BOOKED
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 flex items-start justify-between gap-2">
                                                        <h3 className="line-clamp-1 text-base font-bold text-white">{cls.name}</h3>
                                                        <div className="shrink-0 text-right">
                                                            <p className="text-xs font-bold text-primary">{classTime.start}</p>
                                                            <p className="text-[10px] text-text-muted">{classTime.end ? classTime.end : `${cls.duration} min`}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                                        <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">person</span>{cls.trainer?.name || 'TBA'}</span>
                                                        <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">calendar_today</span>{cls.dayOfWeek}</span>
                                                        {scheduleType === 'ONE_TIME' && (
                                                            <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">event</span>{formatDateLabel(cls.oneTimeDate || cls.sessionDate)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="mb-1.5 flex items-center justify-between">
                                                    <span className="text-xs text-text-muted">{cls.enrolled} / {cls.capacity} spots filled</span>
                                                    <span className={`text-xs font-bold ${isFull ? 'text-red-400' :
                                                        capacityPercent > 75 ? 'text-yellow-400' :
                                                            'text-emerald-400'
                                                        }`}>
                                                        {isFull ? 'Full' : `${cls.capacity - cls.enrolled} left`}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                                    <div
                                                        className={`h-full transition-all ${isFull ? 'bg-red-500' :
                                                            capacityPercent > 75 ? 'bg-yellow-500' :
                                                                'bg-emerald-500'
                                                            }`}
                                                        style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {cls.isBooked ? (
                                                <button
                                                    onClick={() => handleCancel(cls.id, cls.sessionDate)}
                                                    className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 active:scale-95 transition-all text-sm border border-red-500/20 flex items-center justify-center gap-1"
                                                >
                                                    <span className="material-icons-round text-base">cancel</span>
                                                    Leave Class
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleBook(cls.id, cls.sessionDate)}
                                                    disabled={cannotJoin}
                                                    className={`w-full py-2.5 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-1 ${cannotJoin
                                                        ? 'bg-white/5 text-text-muted cursor-not-allowed border border-white/5'
                                                        : 'bg-primary text-background hover:brightness-110 active:scale-95 shadow-lg'
                                                        }`}
                                                >
                                                    <span className="material-icons-round text-base">
                                                        {isFull ? 'block' : noSessionsLeft ? 'lock' : 'add_circle'}
                                                    </span>
                                                    {isFull ? 'Class Full' : noSessionsLeft ? 'No Sessions Left' : 'Join Class'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            ) : (
                <section className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Completed</p>
                            <p className="text-base font-bold text-emerald-300 mt-1">{historyStatusCounts.completed}</p>
                        </div>
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Missed</p>
                            <p className="text-base font-bold text-rose-300 mt-1">{historyStatusCounts.missed}</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Cancelled</p>
                            <p className="text-base font-bold text-amber-300 mt-1">{historyStatusCounts.cancelled}</p>
                        </div>
                    </div>

                    <div className="bg-surface border border-white/10 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-white font-bold text-base">Joined Class History</h2>
                                <p className="text-text-muted text-xs mt-0.5">Review your past completed, missed, and cancelled class joins</p>
                            </div>
                            <button
                                type="button"
                                onClick={fetchClassHistory}
                                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-text-muted hover:text-white"
                            >
                                Refresh
                            </button>
                        </div>

                        {historyLoading ? (
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-muted">Loading class history...</div>
                        ) : historyError ? (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-4 text-sm text-red-300">{historyError}</div>
                        ) : filteredHistoryEntries.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-muted">No past class history found for this filter.</div>
                        ) : (
                            <div className="space-y-2.5">
                                {filteredHistoryEntries.map((entry) => {
                                    const classTime = getClassTimeRange(entry?.class?.time, entry?.class?.duration);
                                    return (
                                        <article key={`class-history-${entry.id}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{entry?.class?.name || 'Class Session'}</p>
                                                    <p className="text-[11px] text-text-muted mt-0.5">
                                                        {formatDateLabel(entry.date)} at {formatTimeLabel(entry.date)}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${toHistoryStatusClass(entry.normalizedHistoryStatus)}`}>
                                                    {toHistoryStatusLabel(entry.normalizedHistoryStatus)}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">person</span>
                                                    {entry?.class?.trainer?.name || 'Trainer'}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">schedule</span>
                                                    {classTime.label}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">event</span>
                                                    {String(entry.status || '').replace(/_/g, ' ') || 'N/A'}
                                                </span>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
