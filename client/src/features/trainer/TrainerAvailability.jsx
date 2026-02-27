import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const WEEKDAY_OPTIONS = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 }
];

const toIsoDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

const getWeeklyWindowForDate = (isoDate, byDay = {}) => {
    const dateObj = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(dateObj.getTime())) return null;
    const dayConfig = byDay[String(dateObj.getDay())];
    if (!dayConfig) return null;
    return {
        start: dayConfig.start || '09:00',
        end: dayConfig.end || '18:00'
    };
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

export default function TrainerAvailability() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [conflicts, setConflicts] = useState([]);

    const [availabilityByDay, setAvailabilityByDay] = useState({});
    const [availabilityIntervalMinutes, setAvailabilityIntervalMinutes] = useState(30);
    const [specificDateAvailability, setSpecificDateAvailability] = useState({});
    const [bookingStatus, setBookingStatus] = useState('OPEN');

    const [activeView, setActiveView] = useState('WEEKLY');
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const res = await axios.get('/api/trainer/me');
                const hydrated = hydrateFromTrainer(res.data || {});
                setAvailabilityByDay(hydrated.availabilityByDay);
                setAvailabilityIntervalMinutes(hydrated.availabilityIntervalMinutes);
                setSpecificDateAvailability(hydrated.specificDateAvailability);
                setBookingStatus(hydrated.bookingStatus);
            } catch (e) {
                setError(e.response?.data?.error || 'Failed to load trainer availability.');
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

    const calendarCells = useMemo(() => getCalendarCells(monthCursor), [monthCursor]);
    const selectedDateOverride = specificDateAvailability[selectedDate] || null;
    const selectedWeeklyWindow = getWeeklyWindowForDate(selectedDate, availabilityByDay);

    const selectedMode = !selectedDateOverride
        ? 'DEFAULT'
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
        const fallback = selectedWeeklyWindow || { start: '09:00', end: '18:00' };
        setSpecificDateAvailability((prev) => {
            const next = { ...(prev || {}) };
            if (mode === 'DEFAULT') {
                delete next[selectedDate];
                return next;
            }
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
            const fallback = selectedWeeklyWindow || { start: '09:00', end: '18:00' };
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

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        setConflicts([]);
        try {
            const payload = {
                availabilityByDay,
                availabilityIntervalMinutes,
                specificDateAvailability,
                bookingStatus
            };
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
            setSuccess('Availability updated.');
        } catch (e) {
            const status = e?.response?.status ? ` (HTTP ${e.response.status})` : '';
            const rawMessage =
                e?.response?.data?.error ||
                (typeof e?.response?.data === 'string' ? e.response.data : '') ||
                e?.message ||
                'Failed to update availability.';
            const message = `${String(rawMessage).trim() || 'Failed to update availability.'}${status}`;
            setError(message);
            const backendConflicts = Array.isArray(e.response?.data?.conflicts) ? e.response.data.conflicts : [];
            setConflicts(backendConflicts);
        } finally {
            setSaving(false);
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

    return (
        <div className="space-y-5">
            <header>
                <h1 className="text-3xl font-bold text-white">My Availability</h1>
                <p className="text-text-muted mt-1">Set weekly hours and add date-specific overrides.</p>
            </header>

            <section className="bg-surface rounded-2xl border border-white/5 p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Weekly Days</p>
                        <p className="text-white text-xl font-bold mt-1">{selectedDayKeys.length}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Date Overrides</p>
                        <p className="text-white text-xl font-bold mt-1">{overrideCount}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Slot Interval</p>
                        <p className="text-white text-xl font-bold mt-1">{availabilityIntervalMinutes} min</p>
                    </div>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <p className="text-sm font-semibold text-white mb-2">Booking Visibility</p>
                    <p className="text-xs text-text-muted mb-3">When closed, your profile is hidden from member trainer booking.</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setBookingStatus('OPEN')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${bookingStatus === 'OPEN'
                                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                                : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                                }`}
                        >
                            Open For Booking
                        </button>
                        <button
                            type="button"
                            onClick={() => setBookingStatus('CLOSED')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${bookingStatus === 'CLOSED'
                                ? 'bg-rose-500/20 text-rose-200 border-rose-500/30'
                                : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                                }`}
                        >
                            Closed For Booking
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveView('WEEKLY')}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${activeView === 'WEEKLY'
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                            }`}
                    >
                        Weekly Template
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('DATES')}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${activeView === 'DATES'
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                            }`}
                    >
                        Date Overrides
                    </button>
                </div>

                {activeView === 'WEEKLY' ? (
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-semibold text-white mb-2">Available Days</p>
                            <p className="text-xs text-text-muted mb-3">Default schedule for all dates unless a date override is set.</p>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAY_OPTIONS.map((day) => {
                                    const selected = Boolean(availabilityByDay[String(day.value)]);
                                    return (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => toggleDay(day.value)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${selected
                                                ? 'bg-primary/15 text-primary border-primary/30'
                                                : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                                                }`}
                                        >
                                            {day.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedDayKeys.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedDayKeys.map((day) => {
                                    const dayConfig = availabilityByDay[String(day)] || { start: '09:00', end: '18:00' };
                                    return (
                                        <div key={day} className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                                            <p className="text-xs font-bold text-white mb-3 uppercase tracking-wider">
                                                {WEEKDAY_OPTIONS.find((d) => d.value === day)?.label}
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Start</label>
                                                    <input
                                                        type="time"
                                                        value={dayConfig.start || '09:00'}
                                                        onChange={(e) => setDayTime(day, 'start', e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">End</label>
                                                    <input
                                                        type="time"
                                                        value={dayConfig.end || '18:00'}
                                                        onChange={(e) => setDayTime(day, 'end', e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200">
                                No weekly day selected. Bookings will be blocked unless a specific date is set to custom available.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-3">
                                <button
                                    type="button"
                                    onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                                >
                                    <span className="material-icons-round text-base">chevron_left</span>
                                </button>
                                <p className="text-sm font-semibold text-white">
                                    {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white"
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
                                            className={`h-10 rounded-lg text-xs font-semibold transition-all relative ${isPast
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
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-300"></span>Unavailable override</span>
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-200"></span>Custom-hours override</span>
                            </div>
                        </div>

                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-4">
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

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDateMode('DEFAULT')}
                                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold ${selectedMode === 'DEFAULT'
                                        ? 'bg-primary/15 border-primary/30 text-primary'
                                        : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    Follow Weekly Template
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDateMode('CLOSED')}
                                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold ${selectedMode === 'CLOSED'
                                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-200'
                                        : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    Unavailable (No Bookings)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDateMode('CUSTOM')}
                                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold ${selectedMode === 'CUSTOM'
                                        ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-100'
                                        : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    Custom Hours
                                </button>
                            </div>

                            {selectedMode === 'CUSTOM' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Start</label>
                                        <input
                                            type="time"
                                            value={selectedDateOverride?.start || selectedWeeklyWindow?.start || '09:00'}
                                            onChange={(e) => setSelectedDateTime('start', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">End</label>
                                        <input
                                            type="time"
                                            value={selectedDateOverride?.end || selectedWeeklyWindow?.end || '18:00'}
                                            onChange={(e) => setSelectedDateTime('end', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="bg-black/20 border border-white/10 rounded-lg px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wider text-text-muted">Weekly Template For This Day</p>
                                <p className="text-xs text-white mt-1">
                                    {selectedWeeklyWindow
                                        ? `${selectedWeeklyWindow.start} - ${selectedWeeklyWindow.end}`
                                        : 'No weekly availability'}
                                </p>
                            </div>

                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={clearSelectedDateOverride}
                                    disabled={selectedMode === 'DEFAULT'}
                                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                                >
                                    Clear This Override
                                </button>
                                <button
                                    type="button"
                                    onClick={clearAllOverrides}
                                    disabled={overrideCount === 0}
                                    className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-xs">
                    <label className="block text-xs text-text-muted uppercase tracking-wider font-bold mb-2">Slot Interval</label>
                    <select
                        value={availabilityIntervalMinutes}
                        onChange={(e) => setAvailabilityIntervalMinutes(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary"
                    >
                        {[15, 30, 45, 60].map((v) => (
                            <option key={v} value={v} className="bg-[#1a1d24]">{v} minutes</option>
                        ))}
                    </select>
                </div>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl bg-primary text-background text-sm font-bold hover:brightness-110 disabled:opacity-70 transition-all"
                >
                    {saving ? 'Saving...' : 'Save Availability'}
                </button>

                {success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-200">
                        {success}
                    </div>
                )}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-200">
                        {error}
                    </div>
                )}

                {conflicts.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
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
                    </div>
                )}
            </section>
        </div>
    );
}
