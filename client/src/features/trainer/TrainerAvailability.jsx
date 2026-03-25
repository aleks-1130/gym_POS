import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const WEEKDAY_OPTIONS = [
    { label: 'Sunday', short: 'Sun', value: 0 },
    { label: 'Monday', short: 'Mon', value: 1 },
    { label: 'Tuesday', short: 'Tue', value: 2 },
    { label: 'Wednesday', short: 'Wed', value: 3 },
    { label: 'Thursday', short: 'Thu', value: 4 },
    { label: 'Friday', short: 'Fri', value: 5 },
    { label: 'Saturday', short: 'Sat', value: 6 }
];
const WEEKDAY_TAB_ORDER = [1, 2, 3, 4, 5, 6, 0];

const toIsoDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatTime12h = (timeValue) => {
    if (!/^\d{2}:\d{2}$/.test(String(timeValue || ''))) return '--';
    const [rawHour, rawMinute] = String(timeValue).split(':');
    const hour = Number(rawHour);
    const minute = Number(rawMinute);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '--';
    const period = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${period}`;
};

const normalizeByDay = (trainer = {}) => {
    if (trainer?.availabilityByDay && typeof trainer.availabilityByDay === 'object') {
        return trainer.availabilityByDay;
    }
    if (Array.isArray(trainer?.availabilityDays)) {
        return trainer.availabilityDays.reduce((acc, day) => {
            acc[String(day)] = {
                start: trainer.availabilityStart || '09:00',
                end: trainer.availabilityEnd || '18:00'
            };
            return acc;
        }, {});
    }
    return {};
};

const normalizeSpecificDates = (trainer = {}) => {
    if (!trainer?.specificDateAvailability || typeof trainer.specificDateAvailability !== 'object') {
        return {};
    }
    const result = {};
    for (const [isoDate, raw] of Object.entries(trainer.specificDateAvailability)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) continue;
        if (raw?.available === false) {
            result[isoDate] = { available: false };
            continue;
        }
        result[isoDate] = {
            available: true,
            start: raw?.start || '09:00',
            end: raw?.end || '18:00'
        };
    }
    return result;
};

const getCalendarCells = (monthCursor) => {
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
};

const hydrateFromTrainer = (trainer) => ({
    availabilityByDay: normalizeByDay(trainer),
    availabilityIntervalMinutes: Number(trainer?.availabilityIntervalMinutes) || 30,
    specificDateAvailability: normalizeSpecificDates(trainer),
    bookingStatus: String(trainer?.bookingStatus || 'OPEN').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN'
});

const cloneAvailabilityByDay = (source = {}) => {
    return Object.entries(source || {}).reduce((acc, [key, value]) => {
        acc[String(key)] = {
            start: value?.start || '09:00',
            end: value?.end || '18:00'
        };
        return acc;
    }, {});
};

const cloneSpecificDateAvailability = (source = {}) => {
    return Object.entries(source || {}).reduce((acc, [key, value]) => {
        if (value?.available === false) {
            acc[String(key)] = { available: false };
            return acc;
        }
        acc[String(key)] = {
            available: true,
            start: value?.start || '09:00',
            end: value?.end || '18:00'
        };
        return acc;
    }, {});
};

const getAuthHeaders = () => {
    
    return undefined;
};

export default function TrainerAvailability({ embedded = false, allowBookingStatusChange = true }) {
    const [loading, setLoading] = useState(true);
    const [savingBookingStatus, setSavingBookingStatus] = useState(false);
    const [savingWeeklySchedule, setSavingWeeklySchedule] = useState(false);
    const [savingDateChanges, setSavingDateChanges] = useState(false);
    const [bookingStatusError, setBookingStatusError] = useState('');
    const [bookingStatusSuccess, setBookingStatusSuccess] = useState('');
    const [weeklyError, setWeeklyError] = useState('');
    const [weeklySuccess, setWeeklySuccess] = useState('');
    const [dateError, setDateError] = useState('');
    const [dateSuccess, setDateSuccess] = useState('');
    const [conflicts, setConflicts] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    const [availabilityByDay, setAvailabilityByDay] = useState({});
    const [availabilityIntervalMinutes, setAvailabilityIntervalMinutes] = useState(30);
    const [specificDateAvailability, setSpecificDateAvailability] = useState({});
    const [bookingStatus, setBookingStatus] = useState('OPEN');
    const [isBookingStatusModalOpen, setIsBookingStatusModalOpen] = useState(false);
    const [pendingBookingStatus, setPendingBookingStatus] = useState(null);
    const [isWeeklyEditing, setIsWeeklyEditing] = useState(false);
    const [weeklySnapshot, setWeeklySnapshot] = useState(null);
    const [isDateEditing, setIsDateEditing] = useState(false);
    const [dateSnapshot, setDateSnapshot] = useState(null);

    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
    const [weeklyActiveDay, setWeeklyActiveDay] = useState(1);

    const fetchMySessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            let res = null;
            try {
                res = await axios.get('/api/trainer/me/sessions');
            } catch (primaryError) {
                const status = Number(primaryError?.response?.status || 0);
                if (status === 404 || status === 405) {
                    res = await axios.get('/api/trainers/me/sessions');
                } else {
                    throw primaryError;
                }
            }
            setSessions(Array.isArray(res?.data) ? res.data : []);
        } catch {
            setSessions([]);
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchMe = async () => {
            try {
                let res = null;
                try {
                    res = await axios.get('/api/trainer/me');
                } catch (primaryError) {
                    const status = Number(primaryError?.response?.status || 0);
                    if (status === 404 || status === 405) {
                        res = await axios.get('/api/trainers/me');
                    } else {
                        throw primaryError;
                    }
                }
                const hydrated = hydrateFromTrainer(res.data || {});
                setAvailabilityByDay(hydrated.availabilityByDay);
                setAvailabilityIntervalMinutes(hydrated.availabilityIntervalMinutes);
                setSpecificDateAvailability(hydrated.specificDateAvailability);
                setBookingStatus(hydrated.bookingStatus);
                setIsBookingStatusModalOpen(false);
                setPendingBookingStatus(null);
                setIsWeeklyEditing(false);
                setWeeklySnapshot(null);
                setIsDateEditing(false);
                setDateSnapshot(null);
                await fetchMySessions();
            } catch (e) {
                setWeeklyError(e.response?.data?.error || 'Failed to load trainer availability.');
            } finally {
                setLoading(false);
            }
        };
        fetchMe();
    }, [fetchMySessions]);

    const selectedDayKeys = useMemo(() => {
        return Object.keys(availabilityByDay || {})
            .map(Number)
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
            .sort((a, b) => a - b);
    }, [availabilityByDay]);
    const weeklyActiveOption = WEEKDAY_OPTIONS.find((day) => day.value === weeklyActiveDay) || WEEKDAY_OPTIONS[1];
    const weeklyActiveConfig = availabilityByDay[String(weeklyActiveDay)] || null;

    const calendarCells = useMemo(() => getCalendarCells(monthCursor), [monthCursor]);
    const selectedDateOverride = specificDateAvailability[selectedDate] || null;
    const selectedMode = !selectedDateOverride
        ? 'NONE'
        : selectedDateOverride.available === false
            ? 'CLOSED'
            : 'CUSTOM';

    const overrideCount = Object.keys(specificDateAvailability || {}).length;
    const bookingsByDate = useMemo(() => {
        const grouped = {};
        (Array.isArray(sessions) ? sessions : []).forEach((session) => {
            const status = String(session?.status || '').toUpperCase();
            if (['CANCELLED', 'DECLINED', 'COMPLETED', 'NO_SHOW'].includes(status)) return;
            const dateObj = new Date(session?.date);
            if (Number.isNaN(dateObj.getTime())) return;
            const isoDate = toIsoDate(dateObj);
            if (!grouped[isoDate]) grouped[isoDate] = [];
            grouped[isoDate].push({
                id: session.id,
                date: session.date,
                status,
                duration: Number(session?.duration) || 0,
                memberName: session?.member
                    ? `${session.member.firstName || ''} ${session.member.lastName || ''}`.trim()
                    : 'Member'
            });
        });

        Object.values(grouped).forEach((items) => {
            items.sort((a, b) => new Date(a.date) - new Date(b.date));
        });
        return grouped;
    }, [sessions]);
    const bookedDayCount = Object.keys(bookingsByDate || {}).length;
    const upcomingBookingCount = useMemo(() => {
        return Object.values(bookingsByDate).reduce((sum, items) => sum + items.length, 0);
    }, [bookingsByDate]);
    const selectedDateBookings = bookingsByDate[selectedDate] || [];

    const toggleDay = (day) => {
        const key = String(day);
        setAvailabilityByDay((prev) => {
            const next = { ...(prev || {}) };
            if (next[key]) {
                delete next[key];
            } else {
                next[key] = { start: '09:00', end: '18:00' };
            }
            return next;
        });
    };

    const setDayTime = (day, field, value) => {
        const key = String(day);
        setAvailabilityByDay((prev) => ({
            ...(prev || {}),
            [key]: {
                ...(prev?.[key] || { start: '09:00', end: '18:00' }),
                [field]: value
            }
        }));
    };

    const setSelectedDateMode = (mode) => {
        const fallback = { start: '09:00', end: '18:00' };
        setSpecificDateAvailability((prev) => {
            const next = { ...(prev || {}) };
            if (mode === 'CLOSED') {
                next[selectedDate] = { available: false };
                return next;
            }
            const existing = next[selectedDate] || {};
            next[selectedDate] = {
                available: true,
                start: existing.start || fallback.start,
                end: existing.end || fallback.end
            };
            return next;
        });
    };

    const setSelectedDateTime = (field, value) => {
        setSpecificDateAvailability((prev) => {
            const fallback = { start: '09:00', end: '18:00' };
            const existing = prev?.[selectedDate] && prev[selectedDate].available !== false
                ? prev[selectedDate]
                : { available: true, start: fallback.start, end: fallback.end };
            return {
                ...(prev || {}),
                [selectedDate]: {
                    ...existing,
                    available: true,
                    [field]: value
                }
            };
        });
    };

    const clearSelectedDateOverride = () => {
        setSpecificDateAvailability((prev) => {
            const next = { ...(prev || {}) };
            delete next[selectedDate];
            return next;
        });
    };

    const clearAllOverrides = () => {
        setSpecificDateAvailability({});
    };

    const startWeeklyEdit = () => {
        if (isWeeklyEditing) return;
        setWeeklySnapshot({
            availabilityByDay: cloneAvailabilityByDay(availabilityByDay),
            availabilityIntervalMinutes
        });
        setWeeklyError('');
        setWeeklySuccess('');
        setIsWeeklyEditing(true);
    };

    const cancelWeeklyEdit = () => {
        if (!isWeeklyEditing) return;
        if (weeklySnapshot) {
            setAvailabilityByDay(cloneAvailabilityByDay(weeklySnapshot.availabilityByDay));
            setAvailabilityIntervalMinutes(Number(weeklySnapshot.availabilityIntervalMinutes) || 30);
        }
        setIsWeeklyEditing(false);
        setWeeklySnapshot(null);
    };

    const startDateEdit = () => {
        if (isDateEditing) return;
        setDateSnapshot(cloneSpecificDateAvailability(specificDateAvailability));
        setDateError('');
        setDateSuccess('');
        setIsDateEditing(true);
    };

    const cancelDateEdit = () => {
        if (!isDateEditing) return;
        if (dateSnapshot) {
            setSpecificDateAvailability(cloneSpecificDateAvailability(dateSnapshot));
        }
        setIsDateEditing(false);
        setDateSnapshot(null);
        setDateError('');
    };

    const getApiErrorMessage = (e, fallback) => {
        const status = e?.response?.status ? ` (HTTP ${e.response.status})` : '';
        const rawMessage =
            e?.response?.data?.error ||
            (typeof e?.response?.data === 'string' ? e.response.data : '') ||
            e?.message ||
            fallback;
        return `${String(rawMessage).trim() || fallback}${status}`;
    };

    const patchAvailability = async (payload) => {
        let res = null;
        try {
            res = await axios.patch('/api/trainer/me/availability', payload);
        } catch (primaryError) {
            const status = Number(primaryError?.response?.status || 0);
            if (status === 404 || status === 405) {
                res = await axios.patch('/api/trainers/me/availability', payload);
            } else {
                throw primaryError;
            }
        }
        const hydrated = hydrateFromTrainer(res.data || {});
        setAvailabilityByDay(hydrated.availabilityByDay);
        setAvailabilityIntervalMinutes(hydrated.availabilityIntervalMinutes);
        setSpecificDateAvailability(hydrated.specificDateAvailability);
        setBookingStatus(hydrated.bookingStatus);
        return hydrated;
    };

    const handleBookingStatusChange = async (nextStatus) => {
        const normalized = String(nextStatus || '').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN';
        if (normalized === bookingStatus || savingBookingStatus) return;

        const previousStatus = bookingStatus;
        setBookingStatus(normalized);
        setSavingBookingStatus(true);
        setBookingStatusError('');
        setBookingStatusSuccess('');
        setConflicts([]);
        try {
            await patchAvailability({ bookingStatus: normalized });
            setBookingStatusSuccess(`Booking status updated to ${normalized === 'OPEN' ? 'Open For Booking' : 'Closed For Booking'}.`);
        } catch (e) {
            setBookingStatus(previousStatus);
            setBookingStatusError(getApiErrorMessage(e, 'Failed to update booking status.'));
        } finally {
            setSavingBookingStatus(false);
        }
    };

    const requestBookingStatusChange = (nextStatus) => {
        const normalized = String(nextStatus || '').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN';
        if (normalized === bookingStatus || savingBookingStatus) return;
        setPendingBookingStatus(normalized);
        setIsBookingStatusModalOpen(true);
    };

    const closeBookingStatusModal = () => {
        if (savingBookingStatus) return;
        setIsBookingStatusModalOpen(false);
        setPendingBookingStatus(null);
    };

    const confirmBookingStatusChange = async () => {
        if (!pendingBookingStatus || savingBookingStatus) return;
        const targetStatus = pendingBookingStatus;
        setIsBookingStatusModalOpen(false);
        setPendingBookingStatus(null);
        await handleBookingStatusChange(targetStatus);
    };

    const handleSaveWeeklySchedule = async () => {
        setSavingWeeklySchedule(true);
        setWeeklyError('');
        setWeeklySuccess('');
        setConflicts([]);
        try {
            await patchAvailability({
                availabilityByDay,
                availabilityIntervalMinutes
            });
            setWeeklySuccess('Weekly schedule saved.');
            setIsWeeklyEditing(false);
            setWeeklySnapshot(null);
        } catch (e) {
            setWeeklyError(getApiErrorMessage(e, 'Failed to save weekly schedule.'));
            const backendConflicts = Array.isArray(e.response?.data?.conflicts) ? e.response.data.conflicts : [];
            setConflicts(backendConflicts);
        } finally {
            setSavingWeeklySchedule(false);
        }
    };

    const handleSaveDateChanges = async () => {
        setSavingDateChanges(true);
        setDateError('');
        setDateSuccess('');
        setConflicts([]);
        try {
            await patchAvailability({
                specificDateAvailability
            });
            setDateSuccess('Date changes saved.');
            setIsDateEditing(false);
            setDateSnapshot(null);
        } catch (e) {
            setDateError(getApiErrorMessage(e, 'Failed to save date changes.'));
            const backendConflicts = Array.isArray(e.response?.data?.conflicts) ? e.response.data.conflicts : [];
            setConflicts(backendConflicts);
        } finally {
            setSavingDateChanges(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const todayIso = toIsoDate(new Date());
    const nextBookingStatus = bookingStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const selectedDateDisplay = new Date(`${selectedDate}T00:00:00`);
    const selectedDateLabel = Number.isNaN(selectedDateDisplay.getTime())
        ? selectedDate
        : selectedDateDisplay.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

    return (
        <div className="space-y-4 sm:space-y-5">
            {!embedded && (
                <header className="px-1 py-2">
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-none mb-1.5">Availability & Settings</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">Your Work Hours</h1>
                    <p className="text-text-muted mt-2 text-[13px] font-medium max-w-md leading-relaxed">
                        Define your weekly rhythm and manage special dates for your training sessions.
                    </p>
                </header>
            )}

            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-5 shadow-xl transition-all hover:bg-white/10 group">
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-black group-hover:text-primary transition-colors">Active Days</p>
                    <p className="text-2xl font-black text-white mt-1.5">{selectedDayKeys.length}</p>
                    <p className="text-[10px] text-text-muted/60 mt-1 font-medium">Weekly</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-5 shadow-xl transition-all hover:bg-white/10 group">
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-black group-hover:text-cyan-400 transition-colors">Exceptions</p>
                    <p className="text-2xl font-black text-white mt-1.5">{overrideCount}</p>
                    <p className="text-[10px] text-text-muted/60 mt-1 font-medium">Special dates</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-5 shadow-xl transition-all hover:bg-white/10 group">
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-black group-hover:text-emerald-400 transition-colors">Interval</p>
                    <p className="text-2xl font-black text-white mt-1.5">{availabilityIntervalMinutes}m</p>
                    <p className="text-[10px] text-text-muted/60 mt-1 font-medium">Slot duration</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-5 shadow-xl transition-all hover:bg-white/10 group">
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-black group-hover:text-amber-400 transition-colors">Logistics</p>
                    <p className="text-2xl font-black text-white mt-1.5">{upcomingBookingCount}</p>
                    <p className="text-[10px] text-text-muted/60 mt-1 font-medium">New bookings</p>
                </div>
            </section>

            {allowBookingStatusChange && (
                <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden group transition-all hover:bg-white/10">
                    {/* Decorative Background Glow */}
                    <div className={`absolute -right-12 -top-12 w-32 h-32 blur-[60px] opacity-20 rounded-full transition-colors duration-500 ${bookingStatus === 'OPEN' ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full animate-pulse ${bookingStatus === 'OPEN' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                                <h3 className="text-base font-black text-white uppercase tracking-widest leading-none">New Booking Access</h3>
                            </div>
                            <p className="text-[13px] text-text-muted font-medium leading-relaxed max-w-sm">
                                {bookingStatus === 'OPEN' 
                                    ? 'Members can discover and book your available time slots.' 
                                    : 'Your schedule is hidden from members. No new bookings can be made.'
                                }
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${bookingStatus === 'OPEN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    Status: {bookingStatus}
                                </p>
                                <p className="text-[9px] text-text-muted font-bold mt-0.5">Click to toggle</p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={bookingStatus === 'OPEN'}
                                onClick={() => requestBookingStatusChange(nextBookingStatus)}
                                disabled={savingBookingStatus}
                                className={`relative inline-flex h-10 w-20 shrink-0 items-center rounded-full border-2 transition-all shadow-lg ${bookingStatus === 'OPEN'
                                    ? 'bg-emerald-500/20 border-emerald-400 shadow-emerald-500/10'
                                    : 'bg-rose-500/20 border-rose-400 shadow-rose-500/10'
                                    } disabled:opacity-50 active:scale-95`}
                            >
                                <span
                                    className={`inline-flex h-7 w-7 rounded-full shadow-lg transition-all duration-300 transform ${bookingStatus === 'OPEN'
                                        ? 'translate-x-11 bg-emerald-400'
                                        : 'translate-x-1.5 bg-rose-400'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest leading-none mb-1.5">Recurring Schedule</p>
                        <h2 className="text-xl font-black text-white leading-tight">Weekly Rhythm</h2>
                        <p className="text-[13px] text-text-muted mt-2 font-medium max-w-sm">
                            Your baseline schedule that repeats every week.
                        </p>
                    </div>
                    {!isWeeklyEditing && (
                        <button
                            type="button"
                            onClick={startWeeklyEdit}
                            className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95 shadow-lg"
                        >
                            Edit Baseline
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {WEEKDAY_TAB_ORDER.map((dayValue) => {
                        const dayMeta = WEEKDAY_OPTIONS.find((d) => d.value === dayValue);
                        if (!dayMeta) return null;
                        const isActive = weeklyActiveDay === dayValue;
                        const isAvailable = Boolean(availabilityByDay[String(dayValue)]);
                        return (
                            <button
                                key={`weekly-tab-${dayValue}`}
                                type="button"
                                onClick={() => setWeeklyActiveDay(dayValue)}
                                className={`group relative flex flex-col items-center justify-center py-4 rounded-2xl border transition-all duration-300 ${isActive
                                    ? 'bg-primary border-primary shadow-lg shadow-primary/20 scale-105 z-10'
                                    : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10 hover:border-white/20'
                                    }`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? 'text-background' : 'group-hover:text-white transition-colors'}`}>
                                    {dayMeta.short}
                                </span>
                                <div className={`mt-2 w-1.5 h-1.5 rounded-full ${isActive 
                                    ? 'bg-background' 
                                    : isAvailable ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-white/20'
                                }`}></div>
                            </button>
                        );
                    })}
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-xl space-y-6 transition-all">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black text-white leading-tight">{weeklyActiveOption.label}</h3>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={`w-2 h-2 rounded-full ${weeklyActiveConfig ? 'bg-emerald-400' : 'bg-white/20'}`}></span>
                                <p className="text-[13px] text-text-muted font-bold">
                                    {weeklyActiveConfig
                                        ? `${formatTime12h(weeklyActiveConfig.start || '09:00')} — ${formatTime12h(weeklyActiveConfig.end || '18:00')}`
                                        : 'Currently Unavailable'}
                                </p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${weeklyActiveConfig
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.1)]'
                            : 'bg-white/5 text-text-muted border-white/10'
                            }`}>
                            {weeklyActiveConfig ? 'Available' : 'Paused'}
                        </span>
                    </div>

                    {isWeeklyEditing ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => toggleDay(weeklyActiveDay)}
                                    className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all active:scale-[0.98] ${weeklyActiveConfig
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                        }`}
                                >
                                    {weeklyActiveConfig ? 'Mark Unavailable' : 'Set as Available'}
                                </button>
                            </div>

                            {weeklyActiveConfig && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Start Time</label>
                                        <div className="relative group">
                                            <input
                                                type="time"
                                                value={weeklyActiveConfig.start || '09:00'}
                                                onChange={(e) => setDayTime(weeklyActiveDay, 'start', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">End Time</label>
                                        <div className="relative group">
                                            <input
                                                type="time"
                                                value={weeklyActiveConfig.end || '18:00'}
                                                onChange={(e) => setDayTime(weeklyActiveDay, 'end', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/5">
                                <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1 mb-3 block">Slot Duration</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[15, 30, 45, 60].map((v) => (
                                        <button
                                            key={`interval-${v}`}
                                            type="button"
                                            onClick={() => setAvailabilityIntervalMinutes(v)}
                                            className={`py-2.5 rounded-xl text-[11px] font-black border transition-all ${availabilityIntervalMinutes === v
                                                ? 'bg-white text-background border-white shadow-lg'
                                                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                                }`}
                                        >
                                            {v}m
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                                <span className="material-icons-round text-primary text-xl">info</span>
                            </div>
                            <p className="text-[12px] text-text-muted font-medium leading-normal">
                                Select a day above to view its recurring hours. Use the "Edit Baseline" button to modify your schedule.
                            </p>
                        </div>
                    )}
                </div>

                {isWeeklyEditing && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleSaveWeeklySchedule}
                            disabled={savingWeeklySchedule}
                            className="h-12 rounded-[20px] bg-primary text-background text-[11px] font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                        >
                            {savingWeeklySchedule ? 'Saving...' : 'Save Schedule'}
                        </button>
                        <button
                            type="button"
                            onClick={cancelWeeklyEdit}
                            disabled={savingWeeklySchedule}
                            className="h-12 rounded-[20px] bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 transition-all"
                        >
                            Discard
                        </button>
                    </div>
                )}
                
                {weeklySuccess && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3 animate-in fade-in duration-300">
                        <span className="material-icons-round text-emerald-400">check_circle</span>
                        <p className="text-xs font-bold text-emerald-200">{weeklySuccess}</p>
                    </div>
                )}
                {weeklyError && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3 animate-in fade-in duration-300">
                        <span className="material-icons-round text-rose-400">error</span>
                        <p className="text-xs font-bold text-rose-200">{weeklyError}</p>
                    </div>
                )}
            </section>
            <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest leading-none mb-1.5">One-Off Changes</p>
                        <h2 className="text-xl font-black text-white leading-tight">Special Dates</h2>
                        <p className="text-[13px] text-text-muted mt-2 font-medium max-w-sm">
                            Adjust specific days without changing your weekly rhythm.
                        </p>
                    </div>
                    {!isDateEditing && (
                        <button
                            type="button"
                            onClick={startDateEdit}
                            className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95 shadow-lg"
                        >
                            Modify Dates
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
                    {/* Calendar Column */}
                    <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-md p-5 shadow-xl">
                        <div className="flex items-center justify-between mb-6 px-1">
                            <button
                                type="button"
                                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
                            >
                                <span className="material-icons-round text-xl">chevron_left</span>
                            </button>
                            <p className="text-base font-black text-white px-4">
                                {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </p>
                            <button
                                type="button"
                                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
                            >
                                <span className="material-icons-round text-xl">chevron_right</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                <div key={d} className="text-[9px] text-center uppercase tracking-widest text-text-muted font-black opacity-60 px-1 py-2">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1.5">
                            {calendarCells.map((day, idx) => {
                                if (!day) return <div key={`blank-${idx}`} className="h-10 sm:h-12" />;
                                const iso = toIsoDate(day);
                                const isPast = iso < todayIso;
                                const selected = iso === selectedDate;
                                const override = specificDateAvailability[iso];
                                const isClosed = override?.available === false;
                                const isCustom = Boolean(override) && override?.available !== false;
                                const bookingCount = (bookingsByDate[iso] || []).length;
                                const hasBookings = bookingCount > 0;
                                
                                const baseClass = "relative h-10 sm:h-12 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center";
                                
                                if (isPast) return (
                                    <div key={iso} className={`${baseClass} bg-white/[0.02] text-text-muted/20 cursor-not-allowed`}>
                                        {day.getDate()}
                                    </div>
                                );

                                let stateStyles = "bg-white/5 border border-white/5 text-white hover:bg-white/10 hover:scale-105 hover:z-10";
                                if (selected) stateStyles = "bg-primary border-primary text-background shadow-lg shadow-primary/30 z-20 scale-110";
                                else if (isClosed) stateStyles = "bg-rose-500/10 border-rose-500/20 text-rose-400";
                                else if (isCustom) stateStyles = "bg-cyan-500/10 border-cyan-500/20 text-cyan-400";
                                else if (hasBookings) stateStyles = "bg-amber-500/10 border-amber-500/20 text-amber-400";

                                return (
                                    <button
                                        key={iso}
                                        type="button"
                                        onClick={() => setSelectedDate(iso)}
                                        className={`${baseClass} ${stateStyles}`}
                                    >
                                        <span className="relative z-10">{day.getDate()}</span>
                                        {!selected && isClosed && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-rose-400 animate-pulse" />}
                                        {!selected && isCustom && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />}
                                        {hasBookings && (
                                            <span className={`absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 rounded-md text-[8px] font-black flex items-center justify-center ${selected ? 'bg-background text-primary' : 'bg-amber-400 text-black'}`}>
                                                {bookingCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-text-muted">
                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.4)]"></span>Off</span>
                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]"></span>Custom</span>
                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"></span>Booked</span>
                        </div>
                    </div>

                    {/* Details Column */}
                    <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-xl space-y-6">
                        <div>
                            <p className="text-[10px] text-text-muted font-black uppercase tracking-widest leading-none mb-1.5">Focus Date</p>
                            <h3 className="text-lg font-black text-white leading-tight">{selectedDateLabel}</h3>
                        </div>

                        {/* Date Bookings Card */}
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] uppercase tracking-widest text-amber-400 font-black">Agenda</p>
                                {sessionsLoading && <span className="animate-spin material-icons-round text-amber-400 text-xs">sync</span>}
                            </div>
                            
                            {!sessionsLoading && selectedDateBookings.length === 0 && (
                                <p className="text-[12px] text-amber-200/60 font-medium italic">No bookings on this day yet.</p>
                            )}
                            
                            {!sessionsLoading && selectedDateBookings.length > 0 && (
                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                    {selectedDateBookings.map((session) => {
                                        const sessionDate = new Date(session.date);
                                        const sessionTimeLabel = Number.isNaN(sessionDate.getTime()) ? '--:--' : sessionDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                        return (
                                            <div key={session.id} className="rounded-xl bg-black/20 border border-white/5 p-2.5 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-black text-white leading-none">{sessionTimeLabel}</p>
                                                    <p className="text-[10px] text-text-muted mt-1 font-medium truncate">{session.memberName || 'Member'}</p>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">
                                                    {session.status}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {!isDateEditing ? (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] space-y-2">
                                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Status Overview</p>
                                    <p className="text-[13px] text-white font-bold">
                                        {selectedMode === 'NONE' ? 'Following weekly rhythm' : selectedMode === 'CLOSED' ? 'Marked as Day Off' : `Custom hours: ${selectedDateOverride?.start} - ${selectedDateOverride?.end}`}
                                    </p>
                                    <p className="text-[11px] text-text-muted font-medium">Click "Modify Dates" to adjust this specific day.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDateMode('CLOSED')}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-[0.98] ${selectedMode === 'CLOSED'
                                            ? 'bg-rose-500/10 text-rose-400 border-rose-400 shadow-lg shadow-rose-500/10'
                                            : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'
                                            }`}
                                    >
                                        Day Off
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDateMode('CUSTOM')}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-[0.98] ${selectedMode === 'CUSTOM'
                                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-400 shadow-lg shadow-cyan-500/10'
                                            : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'
                                            }`}
                                    >
                                        Custom Hours
                                    </button>
                                </div>

                                {selectedMode === 'CUSTOM' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Daily Start</label>
                                            <input
                                                type="time"
                                                value={selectedDateOverride?.start || '09:00'}
                                                onChange={(e) => setSelectedDateTime('start', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">Daily End</label>
                                            <input
                                                type="time"
                                                value={selectedDateOverride?.end || '18:00'}
                                                onChange={(e) => setSelectedDateTime('end', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1 mb-3 block">Cleanup Actions</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={clearSelectedDateOverride}
                                            disabled={selectedMode === 'NONE'}
                                            className="h-10 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 disabled:opacity-30 transition-all"
                                        >
                                            Reset Date
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearAllOverrides}
                                            disabled={overrideCount === 0}
                                            className="h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition-all"
                                        >
                                            Flush All
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {isDateEditing && (
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                        <button
                            type="button"
                            onClick={handleSaveDateChanges}
                            disabled={savingDateChanges}
                            className="h-12 rounded-[20px] bg-primary text-background text-[11px] font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                        >
                            {savingDateChanges ? 'Saving...' : 'Apply Overrides'}
                        </button>
                        <button
                            type="button"
                            onClick={cancelDateEdit}
                            disabled={savingDateChanges}
                            className="h-12 rounded-[20px] bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 transition-all"
                        >
                            Discard
                        </button>
                    </div>
                )}

                {dateSuccess && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3 animate-in fade-in duration-300">
                        <span className="material-icons-round text-emerald-400">check_circle</span>
                        <p className="text-xs font-bold text-emerald-200">{dateSuccess}</p>
                    </div>
                )}
                {dateError && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3 animate-in fade-in duration-300">
                        <span className="material-icons-round text-rose-400">error</span>
                        <p className="text-xs font-bold text-rose-200">{dateError}</p>
                    </div>
                )}
            </section>

            {conflicts.length > 0 && (
                <section className="rounded-3xl border border-rose-500/20 bg-rose-500/5 backdrop-blur-xl p-6 shadow-2xl space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/20">
                            <span className="material-icons-round text-rose-400 text-xl">warning</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white leading-tight">Schedule Conflicts</h3>
                            <p className="text-[13px] text-rose-200/60 font-medium">The following bookings are now outside your working hours.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {conflicts.map((conflict) => {
                            const dt = new Date(conflict.date);
                            const dateLabel = Number.isNaN(dt.getTime()) ? String(conflict.date) : dt.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={conflict.id} className="rounded-2xl bg-black/40 border border-rose-500/10 p-4 flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-white">{dateLabel}</p>
                                        <p className="text-[12px] text-rose-200/60 font-medium mt-1">{conflict.memberName || 'Member'} — {conflict.duration}m session</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest">Conflict</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {allowBookingStatusChange && isBookingStatusModalOpen && pendingBookingStatus && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={closeBookingStatusModal} />
                    <div className="relative w-full max-w-sm rounded-[32px] border border-white/10 bg-[#1a1d24]/90 backdrop-blur-2xl p-8 shadow-2xl space-y-8 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                        <div className="text-center space-y-3">
                            <div className={`w-20 h-20 rounded-[28px] mx-auto flex items-center justify-center border-2 shadow-2xl transition-all duration-700 ${pendingBookingStatus === 'OPEN' ? 'bg-emerald-500/10 border-emerald-400/50 shadow-emerald-500/20' : 'bg-rose-500/10 border-rose-400/50 shadow-rose-500/20'}`}>
                                <span className={`material-icons-round text-4xl ${pendingBookingStatus === 'OPEN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {pendingBookingStatus === 'OPEN' ? 'lock_open' : 'lock'}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white leading-tight">Change Access?</h3>
                                <p className="text-[14px] text-text-muted mt-2 font-medium px-4">
                                    You are switching to <span className={pendingBookingStatus === 'OPEN' ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>{pendingBookingStatus === 'OPEN' ? 'Open' : 'Private'}</span> mode.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={closeBookingStatusModal}
                                disabled={savingBookingStatus}
                                className="h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-[12px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
                            >
                                Not Now
                            </button>
                            <button
                                type="button"
                                onClick={confirmBookingStatusChange}
                                disabled={savingBookingStatus}
                                className={`h-14 rounded-2xl text-[12px] font-black uppercase tracking-widest text-background active:scale-95 transition-all shadow-xl ${pendingBookingStatus === 'OPEN'
                                    ? 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/20'
                                    : 'bg-rose-400 hover:bg-rose-300 shadow-rose-500/20'
                                    }`}
                            >
                                {savingBookingStatus ? 'Syncing...' : 'Yes, Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
