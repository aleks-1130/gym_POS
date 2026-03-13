import React from 'react';

/**
 * Helper to get Authorization headers from session or local storage.
 */
export const authHeaders = () => {
    
    return undefined;
};

/**
 * Normalizes list data from API responses.
 */
export const normalizeList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

/**
 * Extracts batch ID from training notes.
 */
export const extractBookingBatchId = (notes) => {
    const match = String(notes || '').match(/BOOKING_BATCH_ID=([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
};

/**
 * Formats a Date object to YYYY-MM-DD.
 */
export const toIsoDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Checks if a trainer is temporarily open for a specific date.
 */
export const isTrainerTemporarilyOpenForDate = (trainer, isoDate) => {
    if (!trainer || !isoDate) return false;
    return Boolean(trainer.temporarilyOpenToday) && isoDate === toIsoDate(new Date());
};

/**
 * Converts "HH:mm" string to minutes from midnight.
 */
export const toMinutes = (timeString) => {
    const [h, m] = String(timeString || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

/**
 * Formats "HH:mm" string to "hh:mm AM/PM".
 */
export const formatTimeLabel = (timeString) => {
    const mins = toMinutes(timeString);
    if (mins === null) return timeString;
    const hour24 = Math.floor(mins / 60);
    const minute = mins % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
};

/**
 * Gets the availability window (start/end) for a trainer on a specific date.
 */
export const getTrainerDateWindow = (trainer, isoDate) => {
    if (!trainer || !isoDate) return null;
    const isClosed = String(trainer.bookingStatus || 'OPEN').toUpperCase() === 'CLOSED';
    if (isClosed && !isTrainerTemporarilyOpenForDate(trainer, isoDate)) return null;
    const dateObj = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(dateObj.getTime())) return null;

    const specificDate = trainer.specificDateAvailability?.[isoDate];
    if (specificDate) {
        if (specificDate.available === false) return null;
        return {
            start: specificDate.start || '09:00',
            end: specificDate.end || '18:00'
        };
    }

    const availabilityDays = Array.isArray(trainer.availabilityDays)
        ? trainer.availabilityDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
    if (availabilityDays.length > 0 && !availabilityDays.includes(dateObj.getDay())) return null;

    const dayKey = String(dateObj.getDay());
    const dayConfig = trainer.availabilityByDay?.[dayKey];
    return {
        start: dayConfig?.start || trainer.availabilityStart || '09:00',
        end: dayConfig?.end || trainer.availabilityEnd || '18:00'
    };
};

/**
 * Calculates available time slots for a trainer.
 */
export const getAvailableTimeSlotsForTrainer = (trainer, isoDate, duration) => {
    if (!trainer || !isoDate || !duration) return [];
    const dateObj = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(dateObj.getTime())) return [];

    const window = getTrainerDateWindow(trainer, isoDate);
    if (!window) return [];
    const interval = Number(trainer.availabilityIntervalMinutes) || 30;
    const start = toMinutes(window.start);
    const end = toMinutes(window.end);
    if (start === null || end === null || end <= start) return [];

    const bookedSessions = (trainer.trainingSessions || [])
        .filter((session) => {
            if (session.status === 'CANCELLED') return false;
            const sessionDate = new Date(session.date);
            return toIsoDate(sessionDate) === isoDate;
        })
        .map((session) => {
            const sessionDate = new Date(session.date);
            const sessionStart = sessionDate.getHours() * 60 + sessionDate.getMinutes();
            return {
                start: sessionStart,
                end: sessionStart + (Number(session.duration) || 60)
            };
        });

    const resolvedDuration = Number(duration) || 60;
    const slots = [];
    const todayIso = toIsoDate(new Date());
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    for (let t = start; t + resolvedDuration <= end; t += interval) {
        const slotStart = t;
        const slotEnd = t + resolvedDuration;
        if (isoDate === todayIso && slotStart <= nowMinutes) {
            continue;
        }
        const blocked = bookedSessions.some((session) => slotStart < session.end && slotEnd > session.start);
        if (!blocked) {
            const hh = String(Math.floor(t / 60)).padStart(2, '0');
            const mm = String(t % 60).padStart(2, '0');
            slots.push(`${hh}:${mm}`);
        }
    }
    return slots;
};

/**
 * Gets a list of available dates for a trainer.
 */
export const getAvailableDatesForTrainer = (trainer, daysAhead = 45) => {
    if (!trainer) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i <= daysAhead; i += 1) {
        const current = new Date(today);
        current.setDate(today.getDate() + i);
        const iso = toIsoDate(current);
        const window = getTrainerDateWindow(trainer, iso);
        const start = window ? toMinutes(window.start) : null;
        const end = window ? toMinutes(window.end) : null;
        if (window && start !== null && end !== null && end > start) dates.push(iso);
    }
    return dates;
};

/**
 * Checks if a specific date is available for a trainer.
 */
export const isTrainerDateAvailable = (trainer, isoDate) => {
    if (!trainer || !isoDate) return false;
    return getAvailableDatesForTrainer(trainer).includes(isoDate);
};

/**
 * Formats a label for the buyer (Member, Trainer, or Walk-in).
 */
export const getBuyerLabel = (payment) => {
    if (payment?.member) {
        return `${payment.member.firstName} ${payment.member.lastName}`;
    }
    const cashierRole = String(payment?.cashier?.role || '').toUpperCase();
    if (cashierRole === 'TRAINER' && payment?.cashier?.name) {
        return `${payment.cashier.name} (Trainer)`;
    }
    return 'Walk-in';
};

/**
 * Normalizes payment method labels for display.
 */
export const getMethodLabel = (method) => {
    const normalized = String(method || '').toUpperCase();
    if (normalized === 'COMMISSION_DEDUCTION') return 'Commission Deduction';
    if (normalized === 'GCASH') return 'GCash';
    if (normalized === 'MAYA') return 'Maya';
    if (normalized === 'CARD') return 'Card';
    if (normalized === 'CASH') return 'Cash';
    return method || '-';
};

/**
 * Renders a stylized status badge for payments.
 */
export const renderStatusBadge = (status) => {
    const value = status || 'COMPLETED';
    const base = "px-2 py-1 rounded text-xs font-bold";
    if (value === 'VOIDED') return <span className={`${base} bg-red-500/10 text-red-400 border border-red-500/20`}>VOIDED</span>;
    if (value === 'RETURNED') return <span className={`${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`}>RETURNED</span>;
    if (value === 'PENDING') return <span className={`${base} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>PENDING</span>;
    return <span className={`${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>COMPLETED</span>;
};

/**
 * Generates an array of Date objects (preceded by nulls for empty slots) for the calendar.
 */
export const getCalendarCells = (date) => {
    if (!date) return [];
    const y = date.getFullYear();
    const m = date.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();

    const cells = Array(firstDay).fill(null);
    for (let i = 1; i <= lastDate; i++) {
        cells.push(new Date(y, m, i));
    }
    return cells;
};

/**
 * Gets the valid image source URL for a catalog item.
 */
export const getItemImageSrc = (item) => {
    if (!item) return null;
    const path = item.image || item.photo || item.imageUrl || item.thumbnail;
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return path.startsWith('/') ? path : `/${path}`;
};
