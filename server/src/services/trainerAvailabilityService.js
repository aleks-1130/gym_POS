const prisma = require('../config/prisma');

const DAY_TO_INDEX = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const normalizeDays = (input) => {
    const raw = Array.isArray(input)
        ? input
        : typeof input === 'string'
            ? input.split(',').map((v) => v.trim()).filter(Boolean)
            : [];

    const mapped = raw
        .map((item) => {
            if (Number.isFinite(Number(item))) return Number(item);
            const key = String(item).toLowerCase();
            return DAY_TO_INDEX[key];
        })
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

    return Array.from(new Set(mapped)).sort((a, b) => a - b);
};

const normalizeTime = (value, fallback) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmed)) return fallback;
    const [h, m] = trimmed.split(':').map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return fallback;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const normalizeInterval = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 5 || n > 180) return 30;
    return Math.round(n / 5) * 5;
};

const normalizeBookingStatus = (value, fallback = 'OPEN') => {
    const normalized = String(value || fallback || 'OPEN').trim().toUpperCase();
    return normalized === 'CLOSED' ? 'CLOSED' : 'OPEN';
};

const isValidIsoDate = (value) => {
    if (!ISO_DATE_RE.test(String(value || ''))) return false;
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === value;
};

const normalizeSpecificDateAvailability = (inputValue = {}) => {
    const input = inputValue && typeof inputValue === 'object' ? inputValue : {};
    const normalized = {};
    for (const [dateKeyRaw, entryRaw] of Object.entries(input)) {
        const dateKey = String(dateKeyRaw || '').trim();
        if (!isValidIsoDate(dateKey)) continue;

        if (entryRaw === false) {
            normalized[dateKey] = { available: false };
            continue;
        }

        const entry = entryRaw && typeof entryRaw === 'object' ? entryRaw : {};
        const available = entry.available !== false;
        if (!available) {
            normalized[dateKey] = { available: false };
            continue;
        }

        normalized[dateKey] = {
            available: true,
            start: normalizeTime(entry.start, '09:00'),
            end: normalizeTime(entry.end, '18:00')
        };
    }
    return normalized;
};

const normalizeAvailability = (inputValue = {}, options = {}) => {
    const input = inputValue && typeof inputValue === 'object' ? inputValue : {};
    const previous = options?.previous && typeof options.previous === 'object'
        ? options.previous
        : null;

    const hasWeeklyInput =
        hasOwn(input, 'availabilityByDay') ||
        hasOwn(input, 'availabilityDays') ||
        hasOwn(input, 'availabilityStart') ||
        hasOwn(input, 'availabilityEnd');
    const byDayInput = input.availabilityByDay && typeof input.availabilityByDay === 'object'
        ? input.availabilityByDay
        : null;
    const byDay = {};

    if (hasWeeklyInput && byDayInput) {
        for (const [dayKey, range] of Object.entries(byDayInput)) {
            const day = Number(dayKey);
            if (!Number.isInteger(day) || day < 0 || day > 6) continue;
            const start = normalizeTime(range?.start, '09:00');
            const end = normalizeTime(range?.end, '18:00');
            byDay[String(day)] = { start, end };
        }
    } else if (hasWeeklyInput) {
        const days = normalizeDays(input.availabilityDays);
        const start = normalizeTime(input.availabilityStart, '09:00');
        const end = normalizeTime(input.availabilityEnd, '18:00');
        for (const day of days) {
            byDay[String(day)] = { start, end };
        }
    } else if (previous?.availabilityByDay && typeof previous.availabilityByDay === 'object') {
        for (const [dayKey, range] of Object.entries(previous.availabilityByDay)) {
            const day = Number(dayKey);
            if (!Number.isInteger(day) || day < 0 || day > 6) continue;
            byDay[String(day)] = {
                start: normalizeTime(range?.start, '09:00'),
                end: normalizeTime(range?.end, '18:00')
            };
        }
    }

    const dayKeys = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    const fallbackStart = dayKeys.length ? byDay[String(dayKeys[0])].start : '';
    const fallbackEnd = dayKeys.length ? byDay[String(dayKeys[0])].end : '';
    const intervalMinutes = hasOwn(input, 'availabilityIntervalMinutes')
        ? normalizeInterval(input.availabilityIntervalMinutes)
        : normalizeInterval(previous?.availabilityIntervalMinutes);

    const hasSpecificDateInput = hasOwn(input, 'specificDateAvailability') || hasOwn(input, 'availabilityByDate');
    const specificDateInput = hasOwn(input, 'specificDateAvailability')
        ? input.specificDateAvailability
        : input.availabilityByDate;
    const specificDateAvailability = hasSpecificDateInput
        ? normalizeSpecificDateAvailability(specificDateInput)
        : normalizeSpecificDateAvailability(previous?.specificDateAvailability || {});
    const bookingStatus = hasOwn(input, 'bookingStatus')
        ? normalizeBookingStatus(input.bookingStatus, previous?.bookingStatus || 'OPEN')
        : normalizeBookingStatus(previous?.bookingStatus || 'OPEN');

    return {
        availabilityByDay: byDay,
        availabilityDays: dayKeys,
        availabilityStart: fallbackStart,
        availabilityEnd: fallbackEnd,
        availabilityIntervalMinutes: intervalMinutes,
        specificDateAvailability,
        bookingStatus
    };
};

const getTrainerAvailability = async (trainerId) => {
    const normalizedTrainerId = Number(trainerId);
    if (!Number.isInteger(normalizedTrainerId) || normalizedTrainerId <= 0) return null;

    const record = await prisma.trainerAvailability.findUnique({
        where: { trainerId: normalizedTrainerId }
    });
    if (!record) return null;

    return normalizeAvailability(record.settings || {});
};

const getTrainerAvailabilityMap = async (trainerIds = []) => {
    const uniqueTrainerIds = [...new Set(
        (Array.isArray(trainerIds) ? trainerIds : [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];

    const result = new Map();
    if (uniqueTrainerIds.length === 0) return result;

    const records = await prisma.trainerAvailability.findMany({
        where: { trainerId: { in: uniqueTrainerIds } }
    });

    for (const record of records) {
        result.set(record.trainerId, normalizeAvailability(record.settings || {}));
    }

    return result;
};

const setTrainerAvailability = async (trainerId, availabilityInput) => {
    const normalizedTrainerId = Number(trainerId);
    if (!Number.isInteger(normalizedTrainerId) || normalizedTrainerId <= 0) {
        throw new Error('Invalid trainer ID for availability');
    }

    const current = await getTrainerAvailability(normalizedTrainerId);
    const normalized = normalizeAvailability(availabilityInput, { previous: current });

    await prisma.trainerAvailability.upsert({
        where: { trainerId: normalizedTrainerId },
        create: {
            trainerId: normalizedTrainerId,
            settings: normalized
        },
        update: {
            settings: normalized
        }
    });

    return normalized;
};

const removeTrainerAvailability = async (trainerId) => {
    const normalizedTrainerId = Number(trainerId);
    if (!Number.isInteger(normalizedTrainerId) || normalizedTrainerId <= 0) return;

    await prisma.trainerAvailability.deleteMany({
        where: { trainerId: normalizedTrainerId }
    });
};

const withTrainerAvailability = async (trainer) => {
    if (!trainer) return trainer;
    const availability = await getTrainerAvailability(trainer.id);
    if (!availability) {
        return {
            ...trainer,
            availabilityDays: [],
            availabilityStart: '',
            availabilityEnd: '',
            availabilityIntervalMinutes: 30,
            specificDateAvailability: {},
            bookingStatus: 'OPEN'
        };
    }
    return { ...trainer, ...availability };
};

const timeToMinutes = (timeString) => {
    const [h, m] = String(timeString).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const isTimeAllowedForAvailability = ({ availability, date, time, duration, enforceBookingStatus = true }) => {
    if (!availability) return true;
    if (enforceBookingStatus && normalizeBookingStatus(availability.bookingStatus, 'OPEN') === 'CLOSED') return false;

    const specificDate = availability?.specificDateAvailability?.[String(date || '')];
    if (specificDate) {
        if (specificDate.available === false) return false;
        const startMin = timeToMinutes(specificDate.start);
        const endMin = timeToMinutes(specificDate.end);
        const selectedMin = timeToMinutes(time);
        const durationMin = Number(duration) || 0;
        if ([startMin, endMin, selectedMin].some((v) => v === null) || durationMin <= 0) return false;
        if (selectedMin < startMin) return false;
        if (selectedMin + durationMin > endMin) return false;
        const step = availability.availabilityIntervalMinutes || 30;
        const offset = selectedMin - startMin;
        return offset % step === 0;
    }

    // No weekly availability set = do not block legacy trainers
    if (!availability.availabilityDays || availability.availabilityDays.length === 0) return true;

    const day = new Date(`${date}T00:00:00`).getDay();
    if (!availability.availabilityDays.includes(day)) return false;

    const dayConfig = availability.availabilityByDay?.[String(day)];
    if (!dayConfig) return false;

    const startMin = timeToMinutes(dayConfig.start);
    const endMin = timeToMinutes(dayConfig.end);
    const selectedMin = timeToMinutes(time);
    const durationMin = Number(duration) || 0;
    if ([startMin, endMin, selectedMin].some((v) => v === null) || durationMin <= 0) return false;
    if (selectedMin < startMin) return false;
    if (selectedMin + durationMin > endMin) return false;

    const step = availability.availabilityIntervalMinutes || 30;
    const offset = selectedMin - startMin;
    return offset % step === 0;
};

const isTimeAllowedForTrainer = async ({ trainerId, date, time, duration, enforceBookingStatus = true }) => {
    const availability = await getTrainerAvailability(trainerId);
    return isTimeAllowedForAvailability({ availability, date, time, duration, enforceBookingStatus });
};

module.exports = {
    getTrainerAvailability,
    getTrainerAvailabilityMap,
    setTrainerAvailability,
    removeTrainerAvailability,
    withTrainerAvailability,
    normalizeAvailability,
    isTimeAllowedForAvailability,
    isTimeAllowedForTrainer
};
