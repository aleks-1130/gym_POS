import React, { useEffect, useMemo, useState } from 'react';
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

export default function TrainerAvailability() {
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

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const res = await axios.get('/api/trainer/me');
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
            } catch (e) {
                setWeeklyError(e.response?.data?.error || 'Failed to load trainer availability.');
            } finally {
                setLoading(false);
            }
        };
        fetchMe();
    }, []);

    const selectedDayKeys = useMemo(() => {
        return Object.keys(availabilityByDay)
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

    const overrideCount = Object.keys(specificDateAvailability).length;

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

    return (
        <div className="space-y-4 sm:space-y-5">
            <header>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">My Availability</h1>
                <p className="text-text-muted mt-1 text-sm sm:text-base">Set your normal schedule first, then adjust specific dates only when needed.</p>
            </header>

            <section className="bg-surface rounded-2xl border border-white/5 p-3 sm:p-5 space-y-4 sm:space-y-5">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-lg sm:rounded-xl p-2.5 sm:p-3 bg-black/10">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-muted">Available Days</p>
                        <p className="text-white text-base sm:text-xl font-bold mt-1">{selectedDayKeys.length}</p>
                    </div>
                    <div className="rounded-lg sm:rounded-xl p-2.5 sm:p-3 bg-black/10">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-muted">Date Changes</p>
                        <p className="text-white text-base sm:text-xl font-bold mt-1">{overrideCount}</p>
                    </div>
                    <div className="rounded-lg sm:rounded-xl p-2.5 sm:p-3 bg-black/10">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-muted">Interval</p>
                        <p className="text-white text-base sm:text-xl font-bold mt-1">{availabilityIntervalMinutes}m</p>
                    </div>
                </div>

            </section>

            <section className={`rounded-2xl border p-3 sm:p-5 transition-colors ${bookingStatus === 'OPEN'
                ? 'bg-emerald-500/15 border-emerald-500/35'
                : 'bg-rose-500/15 border-rose-500/35'
                }`}>
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-white">Booking Access</p>
                            <p className={`text-xs mt-1 ${bookingStatus === 'OPEN' ? 'text-emerald-100/90' : 'text-rose-100/90'}`}>
                                Control whether members can create new bookings. Existing confirmed sessions remain valid.
                            </p>
                            <p className="text-sm font-semibold text-white mt-3">
                                {bookingStatus === 'OPEN' ? 'Open For Booking' : 'Closed For Booking'}
                            </p>
                            <p className={`text-xs mt-1 ${bookingStatus === 'OPEN' ? 'text-emerald-100/90' : 'text-rose-100/90'}`}>
                                {bookingStatus === 'OPEN'
                                    ? 'Members can currently book available slots.'
                                    : 'New bookings are currently blocked. Existing sessions stay valid.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={bookingStatus === 'OPEN'}
                            onClick={() => requestBookingStatusChange(nextBookingStatus)}
                            disabled={savingBookingStatus}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors ${bookingStatus === 'OPEN'
                                ? 'bg-emerald-500 border-emerald-300/70'
                                : 'bg-rose-500 border-rose-300/70'
                                } disabled:opacity-60`}
                        >
                            <span
                                className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${bookingStatus === 'OPEN'
                                    ? 'translate-x-7'
                                    : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                    {savingBookingStatus && (
                        <p className={`text-[11px] mt-2 ${bookingStatus === 'OPEN' ? 'text-emerald-100/90' : 'text-rose-100/90'}`}>Updating booking status...</p>
                    )}
                    {bookingStatusSuccess && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 mt-2 text-xs text-emerald-200">
                            {bookingStatusSuccess}
                        </div>
                    )}
                    {bookingStatusError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-2 text-xs text-red-200">
                            {bookingStatusError}
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-surface rounded-2xl border border-white/5 p-3 sm:p-5">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-sm font-semibold text-white mb-2">Weekly Schedule</p>
                            <p className="text-xs text-text-muted">
                                {isWeeklyEditing
                                    ? 'Update your recurring days, hours, and interval, then save your weekly schedule.'
                                    : 'View your recurring availability by day. Click edit only when you need to update it.'}
                            </p>
                        </div>
                        {!isWeeklyEditing && (
                            <button
                                type="button"
                                onClick={startWeeklyEdit}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition-all"
                            >
                                Edit Weekly Schedule
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
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
                                    className={`w-full min-w-0 px-0 py-2 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-bold border transition-all ${isActive
                                        ? 'bg-primary/20 border-primary/40 text-primary'
                                        : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    <span className="block leading-none">{dayMeta.short}</span>
                                    <span className={`block w-1.5 h-1.5 rounded-full mx-auto mt-1 ${isAvailable ? 'bg-emerald-300' : 'bg-white/30'}`}></span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-white">{weeklyActiveOption.label}</p>
                                <p className="text-xs text-text-muted mt-1">
                                    {weeklyActiveConfig
                                        ? `${formatTime12h(weeklyActiveConfig.start || '09:00')} - ${formatTime12h(weeklyActiveConfig.end || '18:00')}`
                                        : 'Unavailable'}
                                </p>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${weeklyActiveConfig
                                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                                : 'bg-white/10 text-text-muted border-white/20'
                                }`}>
                                {weeklyActiveConfig ? 'Available' : 'Off'}
                            </span>
                        </div>

                        {!isWeeklyEditing && (
                            <p className="text-xs text-text-muted">Tap a day tab to view schedule. Use Edit to change this day.</p>
                        )}

                        {isWeeklyEditing && (
                            <div className="space-y-3 border-t border-white/10 pt-3">
                                <button
                                    type="button"
                                    onClick={() => toggleDay(weeklyActiveDay)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${weeklyActiveConfig
                                        ? 'bg-rose-500/15 text-rose-200 border-rose-500/30 hover:bg-rose-500/25'
                                        : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/25'
                                        }`}
                                >
                                    {weeklyActiveConfig ? `Mark ${weeklyActiveOption.short} Unavailable` : `Mark ${weeklyActiveOption.short} Available`}
                                </button>

                                {weeklyActiveConfig ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Start</label>
                                            <input
                                                type="time"
                                                value={weeklyActiveConfig.start || '09:00'}
                                                onChange={(e) => setDayTime(weeklyActiveDay, 'start', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                            <p className="text-[11px] text-text-muted mt-1">{formatTime12h(weeklyActiveConfig.start || '09:00')}</p>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">End</label>
                                            <input
                                                type="time"
                                                value={weeklyActiveConfig.end || '18:00'}
                                                onChange={(e) => setDayTime(weeklyActiveDay, 'end', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                            <p className="text-[11px] text-text-muted mt-1">{formatTime12h(weeklyActiveConfig.end || '18:00')}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-text-muted">This day is off. Mark it available to set start and end time.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="w-full sm:max-w-xs">
                        <label className="block text-xs text-text-muted uppercase tracking-wider font-bold mb-2">Slot Interval</label>
                        {isWeeklyEditing ? (
                            <select
                                value={availabilityIntervalMinutes}
                                onChange={(e) => setAvailabilityIntervalMinutes(Number(e.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary"
                            >
                                {[15, 30, 45, 60].map((v) => (
                                    <option key={v} value={v} className="bg-[#1a1d24]">{v} minutes</option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-sm text-white font-semibold">{availabilityIntervalMinutes} minutes</p>
                        )}
                    </div>

                    {isWeeklyEditing && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={handleSaveWeeklySchedule}
                                disabled={savingWeeklySchedule}
                                className="px-4 py-2.5 rounded-xl bg-primary text-background text-sm font-bold hover:brightness-110 disabled:opacity-70 transition-all w-full"
                            >
                                {savingWeeklySchedule ? 'Saving Weekly Schedule...' : 'Save Weekly Schedule'}
                            </button>
                            <button
                                type="button"
                                onClick={cancelWeeklyEdit}
                                disabled={savingWeeklySchedule}
                                className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 disabled:opacity-70 transition-all w-full"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    {weeklySuccess && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-200">
                            {weeklySuccess}
                        </div>
                    )}
                    {weeklyError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-200">
                            {weeklyError}
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-surface rounded-2xl border border-white/5 p-3 sm:p-5">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-sm font-semibold text-white mb-2">Date Exceptions</p>
                            <p className="text-xs text-text-muted">Set one-day changes like day off or custom hours without changing your weekly schedule.</p>
                        </div>
                        {!isDateEditing && (
                            <button
                                type="button"
                                onClick={startDateEdit}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition-all"
                            >
                                Add / Edit Exceptions
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-3 sm:gap-4">
                        <div className="rounded-xl p-2.5 sm:p-3 bg-black/10">
                            <div className="flex items-center justify-between mb-3">
                                <button
                                    type="button"
                                    onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                                >
                                    <span className="material-icons-round text-base">chevron_left</span>
                                </button>
                                <p className="text-sm font-semibold text-white">
                                    {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                                >
                                    <span className="material-icons-round text-base">chevron_right</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                    <div key={d} className="text-[10px] text-center uppercase tracking-wide text-text-muted font-semibold">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {calendarCells.map((day, idx) => {
                                    if (!day) return <div key={`blank-${idx}`} className="h-10" />;
                                    const iso = toIsoDate(day);
                                    const isPast = iso < todayIso;
                                    const selected = iso === selectedDate;
                                    const override = specificDateAvailability[iso];
                                    const isClosed = override?.available === false;
                                    const isCustom = Boolean(override) && override?.available !== false;
                                    const className = selected
                                        ? 'bg-primary text-background ring-1 ring-primary/60'
                                        : isClosed
                                            ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
                                            : isCustom
                                                ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30'
                                                : 'bg-white/5 text-white border border-white/5 hover:bg-white/10';
                                    return (
                                        <button
                                            key={iso}
                                            type="button"
                                            disabled={isPast}
                                            onClick={() => setSelectedDate(iso)}
                                            className={`h-9 sm:h-10 rounded-lg text-xs font-semibold transition-all relative ${isPast
                                                ? 'bg-white/5 text-text-muted/40 cursor-not-allowed'
                                                : className
                                                }`}
                                        >
                                            {day.getDate()}
                                            {!selected && !isPast && isClosed && (
                                                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                                            )}
                                            {!selected && !isPast && isCustom && (
                                                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-200"></span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-text-muted">
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-300"></span>Day off</span>
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-200"></span>Custom hours</span>
                            </div>
                        </div>

                        <div className="rounded-xl p-3 sm:p-4 space-y-4 bg-black/10">
                            <div>
                                <p className="text-xs text-text-muted uppercase tracking-wider">Selected Date</p>
                                <p className="text-white font-semibold mt-1">
                                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                                        weekday: 'long',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>

                            {!isDateEditing && (
                                <div className="space-y-2">
                                    <p className="text-xs text-text-muted">
                                        Current exceptions: <span className="text-white font-semibold">{overrideCount}</span>
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        {selectedMode === 'NONE'
                                            ? 'No exception set for this date yet.'
                                            : selectedMode === 'CLOSED'
                                                ? 'This date is currently marked as Day Off.'
                                                : `Custom hours: ${selectedDateOverride?.start || '09:00'} - ${selectedDateOverride?.end || '18:00'}`}
                                    </p>
                                    <p className="text-xs text-text-muted">Click "Add / Edit Exceptions" to modify this date.</p>
                                </div>
                            )}

                            {isDateEditing && (
                                <>
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDateMode('CLOSED')}
                                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold ${selectedMode === 'CLOSED'
                                                ? 'bg-rose-500/20 border-rose-500/30 text-rose-200'
                                                : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                                }`}
                                        >
                                            Mark Day Off
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDateMode('CUSTOM')}
                                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold ${selectedMode === 'CUSTOM'
                                                ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-100'
                                                : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                                }`}
                                        >
                                            Set Custom Hours
                                        </button>
                                    </div>

                                    {selectedMode === 'CUSTOM' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Start</label>
                                                <input
                                                    type="time"
                                                    value={selectedDateOverride?.start || '09:00'}
                                                    onChange={(e) => setSelectedDateTime('start', e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">End</label>
                                                <input
                                                    type="time"
                                                    value={selectedDateOverride?.end || '18:00'}
                                                    onChange={(e) => setSelectedDateTime('end', e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={clearSelectedDateOverride}
                                            disabled={selectedMode === 'NONE'}
                                            className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50 w-full"
                                        >
                                            Reset This Date
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearAllOverrides}
                                            disabled={overrideCount === 0}
                                            className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 w-full"
                                        >
                                            Reset All Date Changes
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {isDateEditing && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={handleSaveDateChanges}
                                disabled={savingDateChanges}
                                className="px-4 py-2.5 rounded-xl bg-primary text-background text-sm font-bold hover:brightness-110 disabled:opacity-70 transition-all w-full"
                            >
                                {savingDateChanges ? 'Saving Date Changes...' : 'Save Date Changes'}
                            </button>
                            <button
                                type="button"
                                onClick={cancelDateEdit}
                                disabled={savingDateChanges}
                                className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 disabled:opacity-70 transition-all w-full"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {dateSuccess && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-200">
                            {dateSuccess}
                        </div>
                    )}
                    {dateError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-200">
                            {dateError}
                        </div>
                    )}
                </div>
            </section>

            {conflicts.length > 0 && (
                <section className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 sm:p-4">
                    <p className="text-xs font-bold text-red-200 mb-2">Conflicting Bookings</p>
                    <div className="space-y-2">
                        {conflicts.map((conflict) => {
                            const dt = new Date(conflict.date);
                            const dateLabel = Number.isNaN(dt.getTime())
                                ? String(conflict.date)
                                : dt.toLocaleString([], {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            return (
                                <div key={conflict.id} className="text-xs text-red-100 bg-black/20 rounded-lg px-2.5 py-2 border border-red-500/20">
                                    <span className="font-semibold">{dateLabel}</span>
                                    <span className="text-red-200/90"> - {conflict.duration} min - {conflict.memberName || 'Member'}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {isBookingStatusModalOpen && pendingBookingStatus && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4">
                    <button
                        type="button"
                        aria-label="Close confirmation"
                        onClick={closeBookingStatusModal}
                        className="absolute inset-0 bg-black/70"
                    />
                    <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface p-4 sm:p-5 space-y-4">
                        <div>
                            <p className="text-base font-bold text-white">Confirm Booking Status Change</p>
                            <p className="text-sm text-text-muted mt-2">
                                Change status to{' '}
                                <span className="font-semibold text-white">
                                    {pendingBookingStatus === 'OPEN' ? 'Open For Booking' : 'Closed For Booking'}
                                </span>
                                ?
                            </p>
                            <p className="text-xs text-text-muted mt-2">This helps prevent accidental status changes.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={closeBookingStatusModal}
                                disabled={savingBookingStatus}
                                className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 disabled:opacity-70 transition-all w-full"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmBookingStatusChange}
                                disabled={savingBookingStatus}
                                className={`px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-70 transition-all w-full ${pendingBookingStatus === 'OPEN'
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                                    : 'bg-rose-500 text-white hover:bg-rose-400'
                                    }`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
