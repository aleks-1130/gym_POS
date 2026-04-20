import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { withApiBase } from '../../config/api';
import { useConfirm } from '../../context/ConfirmContext';
import MemberPageHeader from './components/MemberPageHeader';

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
    if (
        rawStatus === 'NO_SHOW'
        || rawStatus === 'MISSED'
        || rawStatus === 'NO_SHOW_REFUND_APPROVED'
        || rawStatus === 'NO_SHOW_RESCHEDULE_APPROVED'
        || rawStatus === 'NO_SHOW_REFUND_REQUESTED'
        || rawStatus === 'NO_SHOW_RESCHEDULE_REQUESTED'
        || rawStatus === 'NO_SHOW_REFUND_REJECTED'
        || rawStatus === 'NO_SHOW_RESCHEDULE_REJECTED'
    ) return 'MISSED';
    if (rawStatus === 'ATTENDED' || rawStatus === 'COMPLETED') return 'COMPLETED';
    if (rawStatus === 'WAITLISTED') return 'WAITLISTED';
    if (rawStatus === 'CONFIRMED' && isFuture) return 'UPCOMING';
    if (rawStatus === 'CONFIRMED' && !isFuture) return 'MISSED';
    return rawStatus || 'UNKNOWN';
};

const getHoursUntilSessionStart = (sessionDateValue) => {
    const sessionDate = new Date(sessionDateValue);
    if (Number.isNaN(sessionDate.getTime())) return null;
    return (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60);
};

const toHistoryStatusLabel = (status) => {
    if (status === 'COMPLETED') return 'Completed';
    if (status === 'MISSED') return 'Missed';
    if (status === 'CANCELLED') return 'Cancelled';
    if (status === 'WAITLISTED') return 'Waitlisted';
    return 'Unknown';
};

const toHistoryStatusClass = (status) => {
    if (status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (status === 'MISSED') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (status === 'CANCELLED') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (status === 'WAITLISTED') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    return 'bg-white/10 text-text-muted border-white/20';
};

const fallbackClassImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%230f172a'/%3E%3Cstop offset='1' stop-color='%231e293b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='480' height='480' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='22'%3EClass Image Unavailable%3C/text%3E%3C/svg%3E";

const handleClassImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackClassImage;
};

const getDayButtonValueFromDate = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;

    const dayMap = {
        0: 'SUN',
        1: 'M',
        2: 'T',
        3: 'W',
        4: 'TH',
        5: 'F',
        6: 'S'
    };
    return dayMap[date.getDay()] || null;
};

export default function Schedule() {
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const sessionPolicyNote = [
        'Class Session Policy',
        '1. Joining a class as CONFIRMED uses 1 class session immediately.',
        '2. Joining WAITLIST does not use a session until you are promoted to CONFIRMED.',
        '3. Leave above 24 hours before class start: 1 session credit is returned.',
        '4. Leave within 24 hours of class start (including exactly 24h): session stays consumed.',
        '5. If trainer marks you as NO SHOW after class, 1 session is auto-credited back.',
        '6. History labels: ATTENDED = Completed, NO SHOW = Missed, Leave Class = Cancelled.'
    ].join('\n');
    const [classes, setClasses] = useState([]);
    const [sessionInfo, setSessionInfo] = useState({
        classSessionsRemaining: 0,
        classSessionsUsed: 0,
        canBookClasses: false
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('schedule'); // schedule | my-classes | history
    const [selectedDay, setSelectedDay] = useState(() => getDayButtonValueFromDate(new Date()));
    const [classHistory, setClassHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [historyFilter, setHistoryFilter] = useState('all');
    const viewMode = 'WEEK';
    const [anchorDate, setAnchorDate] = useState(new Date());

    const getViewRangeLabel = (date, mode = 'WEEK') => {
        if (mode === 'MONTH') {
            return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        }
        
        const day = date.getDay();
        const sunday = new Date(date);
        sunday.setHours(0, 0, 0, 0);
        sunday.setDate(date.getDate() - day);
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);

        const options = { month: 'short', day: 'numeric' };
        return `${sunday.toLocaleDateString(undefined, options)} - ${saturday.toLocaleDateString(undefined, options)}`;
    };

    const fetchClasses = useCallback(async () => {
        try {
            const res = await axios.get(withApiBase('/api/members/classes'), {
                params: { 
                    _t: Date.now(),
                    date: anchorDate.toISOString(),
                    viewMode
                }
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
    }, [anchorDate, viewMode]);

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

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchClasses, fetchClassHistory]);

    const handleBook = async (classId, sessionDate) => {
        const classToBook = classes.find(c => c.id === classId);
        if (!classToBook) return;

        const isFull = classToBook.enrolled >= classToBook.capacity;
        const confirmLabel = isFull ? 'Join Waitlist' : 'Join Class';
        const currentPolicyNote = isFull 
            ? 'Joining WAITLIST does not consume a session. If promoted to CONFIRMED, 1 session will be consumed.'
            : 'Joining as CONFIRMED consumes 1 session now. Leave above 24 hours before class start to restore the credit; within 24 hours it stays consumed.';

        const confirmed = await showConfirm({
            title: isFull ? 'Waitlist' : 'Session Policy',
            message: `${currentPolicyNote} Continue?`,
            confirmLabel: confirmLabel
        });
        if (!confirmed) return;

        try {
            await axios.post(withApiBase('/api/members/book'), { classId, sessionDate });
            await showAlert({ 
                title: isFull ? 'Waitlisted!' : 'Joined!', 
                message: isFull ? 'You have been added to the waitlist.' : 'Joined class successfully!', 
                type: 'success' 
            });
            fetchClasses();
            fetchClassHistory();
        } catch (error) {
            await showAlert({ title: 'Booking Failed', message: error.response?.data?.error || 'Booking failed', type: 'danger' });
        }
    };

    const handleCancel = async (classId, sessionDate, bookingStatus) => {
        const normalizedBookingStatus = String(bookingStatus || '').toUpperCase();
        const isWaitlisted = normalizedBookingStatus === 'WAITLISTED';
        const hoursUntilStart = getHoursUntilSessionStart(sessionDate);
        const canRestoreCredit = !isWaitlisted && hoursUntilStart !== null && hoursUntilStart > 24;
        const policyMessage = isWaitlisted
            ? 'You are currently waitlisted. Leaving now will remove you from waitlist and no class session will be consumed.'
            : canRestoreCredit
                ? 'You are leaving above 24 hours before class start. 1 class session credit will be returned.'
                : 'You are leaving within 24 hours of class start (including exactly 24h). Your class session stays consumed.';

        const policyConfirmed = await showConfirm({
            title: 'Leave Class?',
            message: policyMessage,
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
            const response = await axios.post(withApiBase('/api/members/cancel-booking'), { classId, sessionDate });
            await showAlert({
                title: 'Left Class',
                message: response?.data?.message || 'Class booking updated successfully.',
                type: 'success'
            });
            fetchClasses();
            fetchClassHistory();
        } catch (error) {
            await showAlert({ title: 'Cancel Failed', message: error.response?.data?.error || 'Failed to cancel', type: 'danger' });
        }
    };

    const filteredClasses = useMemo(() => {
        const base = classes.filter((cls) => {
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
    }, [classes, selectedDay]);

    const filteredJoinedClasses = useMemo(() => {
        const base = classes.filter((cls) => {
            if (!cls.isBooked) return false;

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
    }, [classes, selectedDay]);

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
        { value: 'SUN', label: 'SUN' },
        { value: 'M', label: 'M' },
        { value: 'T', label: 'T' },
        { value: 'W', label: 'W' },
        { value: 'TH', label: 'TH' },
        { value: 'F', label: 'F' },
        { value: 'S', label: 'S' }
    ];
    const selectedDayDateLabel = useMemo(() => {
        if (!selectedDay) return getViewRangeLabel(anchorDate, viewMode);

        const dayOffsets = {
            SUN: 0,
            M: 1,
            T: 2,
            W: 3,
            TH: 4,
            F: 5,
            S: 6
        };
        const targetOffset = dayOffsets[selectedDay];
        if (targetOffset === undefined) return getViewRangeLabel(anchorDate, viewMode);

        const weekAnchor = new Date(anchorDate);
        const day = weekAnchor.getDay();
        weekAnchor.setHours(0, 0, 0, 0);
        weekAnchor.setDate(weekAnchor.getDate() - day);

        const selectedDate = new Date(weekAnchor);
        selectedDate.setDate(weekAnchor.getDate() + targetOffset);

        return selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    }, [selectedDay, anchorDate, viewMode]);
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
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
            <MemberPageHeader
                title={activeTab === 'history' ? 'Class History' : activeTab === 'my-classes' ? 'Joined Classes' : 'Classes'}
                subtitle={
                    activeTab === 'history'
                        ? 'Review completed, missed, and cancelled classes'
                        : activeTab === 'my-classes'
                            ? 'Manage your joined and upcoming classes'
                            : 'Browse available classes'
                }
                icon="calendar_month"
                className="border-white/10"
                rightSlot={(
                    <button
                        type="button"
                        onClick={showSessionPolicy}
                        className="shrink-0 h-9 w-9 rounded-lg border border-white/10 bg-surface text-text-secondary hover:text-white hover:bg-white/5"
                        aria-label="View class session policy"
                        title="Session policy"
                    >
                        <span className="material-icons-round text-base">info</span>
                    </button>
                )}
            />

            <section className="space-y-3">
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
            </section>

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

                        <div className="member-card-subtle backdrop-blur-sm p-2 sm:p-3">
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(anchorDate);
                                        d.setDate(d.getDate() - 7);
                                        setAnchorDate(d);
                                    }}
                                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface border border-white/10 text-white hover:bg-white/5 active:scale-90 transition-all"
                                >
                                    <span className="material-icons-round">chevron_left</span>
                                </button>
                                <div className="text-center">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-primary mb-0.5">
                                        Weekly Schedule
                                    </p>
                                    <p className="text-sm font-bold text-white whitespace-nowrap">{selectedDayDateLabel}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(anchorDate);
                                        d.setDate(d.getDate() + 7);
                                        setAnchorDate(d);
                                    }}
                                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface border border-white/10 text-white hover:bg-white/5 active:scale-90 transition-all shadow-lg"
                                >
                                    <span className="material-icons-round">chevron_right</span>
                                </button>
                            </div>

                            <div className="mt-2 border-t border-white/10 pt-2 grid grid-cols-7 gap-2">
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
                                const cannotJoin = noSessionsLeft;
                                const classTime = getClassTimeRange(cls.time, cls.duration);
                                const scheduleType = String(cls.scheduleType || 'RECURRING').toUpperCase();
                                
                                // NEW: Time-based state checks
                                const nowMoment = new Date();
                                const sessionDateStr = cls.sessionDate || cls.oneTimeDate;
                                const sessionMoment = new Date(sessionDateStr);
                                
                                // Merge session date with its start time for precision
                                if (cls.time && !Number.isNaN(sessionMoment.getTime())) {
                                    const timeMinutes = parseTimeToMinutes(cls.time);
                                    if (timeMinutes !== null) {
                                        sessionMoment.setHours(Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);
                                    }
                                }

                                const durationMinutes = Number(cls.duration || 60);
                                const endMoment = new Date(sessionMoment.getTime() + durationMinutes * 60000);
                                
                                const isPast = nowMoment > endMoment;
                                const isInProgress = nowMoment >= sessionMoment && nowMoment <= endMoment;
                                const hasStarted = nowMoment >= sessionMoment;

                                const leaveNotice = cls.isBooked
                                    ? (String(cls.bookingStatus || '').toUpperCase() === 'WAITLISTED'
                                        ? 'Waitlist leave: no session will be consumed.'
                                        : (getHoursUntilSessionStart(sessionDateStr) !== null && getHoursUntilSessionStart(sessionDateStr) > 24
                                            ? 'Leave above 24h before class start: session credit will be returned.'
                                            : 'Leave within 24h of class start (including exactly 24h): session stays consumed.'))
                                    : '';

                                return (
                                    <div
                                        key={cls.id}
                                        className={`group relative bg-[#1e293b]/50 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2rem] border overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.99] ${cls.isBooked
                                            ? cls.bookingStatus === 'WAITLISTED'
                                                ? 'border-cyan-500/35'
                                                : 'border-primary/35'
                                            : 'border-white/5'
                                            }`}
                                    >
                                        <div className="aspect-[16/10] sm:aspect-[4/3] relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent z-10" />
                                            {cls.imageUrl ? (
                                                <img src={cls.imageUrl} alt={cls.name} onError={handleClassImageError} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            ) : (
                                                <div className="h-full w-full bg-[#0f172a] flex items-center justify-center">
                                                    <span className="material-icons-round text-5xl text-white/10">fitness_center</span>
                                                </div>
                                            )}
                                            {cls.isBooked && (
                                                <span className={`absolute top-2.5 left-2.5 z-20 rounded-xl border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                                                    cls.bookingStatus === 'WAITLISTED'
                                                        ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
                                                        : 'bg-primary/20 border-primary/40 text-primary'
                                                }`}>
                                                    {cls.bookingStatus === 'WAITLISTED' ? 'WAITLISTED' : 'BOOKED'}
                                                </span>
                                            )}
                                            <div className="absolute top-2.5 right-2.5 z-20">
                                                <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-1 shadow-xl">
                                                    <span className={`material-icons-round text-xs ${isFull ? 'text-amber-300' : 'text-emerald-300'}`}>people</span>
                                                    <span className="text-[11px] font-black text-white">{cls.enrolled}/{cls.capacity}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 sm:p-5 relative z-10 -mt-8 sm:-mt-10 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="line-clamp-1 text-lg sm:text-xl font-black text-white leading-tight">{cls.name}</h3>
                                                    <p className="text-[10px] font-bold text-white/45 uppercase tracking-widest mt-1">
                                                        {scheduleType === 'ONE_TIME' ? 'One-time Class' : 'Recurring Class'}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm sm:text-base font-black text-primary leading-none">{classTime.start}</p>
                                                    <p className="text-[10px] text-white/45 mt-1">{classTime.end ? classTime.end : `${cls.duration} min`}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="rounded-lg sm:rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                                                    <p className="text-xs font-black text-white leading-none">{cls.duration} min</p>
                                                    <p className="text-[9px] text-white/45 mt-1">duration</p>
                                                </div>
                                                <div className="rounded-lg sm:rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                                                    <p className="text-xs font-black text-white leading-none">{cls.dayOfWeek || 'TBA'}</p>
                                                    <p className="text-[9px] text-white/45 mt-1">day</p>
                                                </div>
                                                <div className="rounded-lg sm:rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                                                    <p className={`text-xs font-black leading-none ${isFull ? 'text-amber-300' : 'text-emerald-300'}`}>{isFull ? 'Full' : `${cls.capacity - cls.enrolled} left`}</p>
                                                    <p className="text-[9px] text-white/45 mt-1">availability</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                                <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">person</span>{cls.trainer?.name || 'TBA'}</span>
                                                {scheduleType === 'ONE_TIME' && (
                                                    <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">event</span>{formatDateLabel(cls.oneTimeDate || cls.sessionDate)}</span>
                                                )}
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
                                                        className={`h-full transition-all ${isFull ? 'bg-amber-500' :
                                                            capacityPercent > 75 ? 'bg-yellow-500' :
                                                                'bg-emerald-500'
                                                            }`}
                                                        style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                                    ></div>
                                                </div>
                                                {isFull && (
                                                    <p className="mt-2 text-[10px] text-amber-300 font-medium">
                                                        Waitlist: {cls.waitlisted || 0} members already waiting
                                                    </p>
                                                )}
                                            </div>

                                            {cls.isBooked && !isPast && (
                                                <p className="text-[11px] font-semibold rounded-lg border px-2.5 py-2 bg-amber-500/10 text-amber-200 border-amber-500/20">
                                                    {leaveNotice}
                                                </p>
                                            )}
                                            {isPast && (
                                                <p className="text-[11px] font-semibold rounded-lg border px-2.5 py-2 bg-rose-500/10 text-rose-300 border-rose-500/20">
                                                    This class has already ended.
                                                </p>
                                            )}

                                            {cls.isBooked ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancel(cls.id, cls.sessionDate || cls.oneTimeDate, cls.bookingStatus)}
                                                    disabled={isPast}
                                                    className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2 ${
                                                        isPast
                                                            ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                                                            : 'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 active:scale-95'
                                                    }`}
                                                >
                                                    <span className="material-icons-round text-sm">{isPast ? 'history' : 'cancel'}</span>
                                                    {isPast ? 'Class Ended' : 'Leave Class'}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleBook(cls.id, cls.sessionDate || cls.oneTimeDate)}
                                                    disabled={cannotJoin || hasStarted}
                                                    className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2 ${
                                                        (cannotJoin || hasStarted)
                                                            ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                                                            : isFull
                                                                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 active:scale-95'
                                                                : 'bg-primary text-background hover:brightness-110 shadow-xl shadow-primary/20 active:scale-95'
                                                    }`}
                                                >
                                                    <span className="material-icons-round text-sm">
                                                        {isPast ? 'history' : isInProgress ? 'play_circle' : isFull ? 'hourglass_top' : noSessionsLeft ? 'lock' : 'add_circle'}
                                                    </span>
                                                    {isPast ? 'Class Ended' : isInProgress ? 'In Progress' : isFull ? 'Join Waitlist' : noSessionsLeft ? 'No Sessions Left' : 'Join Class'}
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
                        <div className="member-card-soft border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Completed</p>
                            <p className="text-base font-bold text-emerald-300 mt-1">{historyStatusCounts.completed}</p>
                        </div>
                        <div className="member-card-soft border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Missed</p>
                            <p className="text-base font-bold text-rose-300 mt-1">{historyStatusCounts.missed}</p>
                        </div>
                        <div className="member-card-soft border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Cancelled</p>
                            <p className="text-base font-bold text-amber-300 mt-1">{historyStatusCounts.cancelled}</p>
                        </div>
                    </div>

                    <div className="member-card p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-white font-bold text-base">Class History</h2>
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
                            <div className="member-card-soft px-3 py-4 text-sm text-text-muted">Loading class history...</div>
                        ) : historyError ? (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-4 text-sm text-red-300">{historyError}</div>
                        ) : filteredHistoryEntries.length === 0 ? (
                            <div className="member-card-soft px-3 py-4 text-sm text-text-muted">No past class history found for this filter.</div>
                        ) : (
                            <div className="space-y-2.5">
                                {filteredHistoryEntries.map((entry) => {
                                    const classTime = getClassTimeRange(entry?.class?.time, entry?.class?.duration);
                                    const rawEntryStatus = String(entry?.status || '').toUpperCase();
                                    const statusDetail = rawEntryStatus.startsWith('NO_SHOW')
                                        ? 'NO SHOW'
                                        : (String(entry?.status || '').replace(/_/g, ' ') || 'N/A');
                                    return (
                                        <article key={`class-history-${entry.id}`} className="member-card-soft p-3">
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
                                                    {statusDetail}
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
