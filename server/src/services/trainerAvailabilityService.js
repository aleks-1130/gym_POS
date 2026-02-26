const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'trainer_availability.json');

const DAY_TO_INDEX = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
};

const ensureStore = () => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
};

const readStore = () => {
    ensureStore();
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
};

const writeStore = (value) => {
    ensureStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(value, null, 2), 'utf8');
};

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

const normalizeAvailability = (input = {}) => {
    const byDayInput = input.availabilityByDay && typeof input.availabilityByDay === 'object'
        ? input.availabilityByDay
        : null;
    const byDay = {};

    if (byDayInput) {
        for (const [dayKey, range] of Object.entries(byDayInput)) {
            const day = Number(dayKey);
            if (!Number.isInteger(day) || day < 0 || day > 6) continue;
            const start = normalizeTime(range?.start, '09:00');
            const end = normalizeTime(range?.end, '18:00');
            byDay[String(day)] = { start, end };
        }
    } else {
        const days = normalizeDays(input.availabilityDays);
        const start = normalizeTime(input.availabilityStart, '09:00');
        const end = normalizeTime(input.availabilityEnd, '18:00');
        for (const day of days) {
            byDay[String(day)] = { start, end };
        }
    }

    const dayKeys = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    const fallbackStart = dayKeys.length ? byDay[String(dayKeys[0])].start : '';
    const fallbackEnd = dayKeys.length ? byDay[String(dayKeys[0])].end : '';
    const intervalMinutes = normalizeInterval(input.availabilityIntervalMinutes);
    return {
        availabilityByDay: byDay,
        availabilityDays: dayKeys,
        availabilityStart: fallbackStart,
        availabilityEnd: fallbackEnd,
        availabilityIntervalMinutes: intervalMinutes
    };
};

const getTrainerAvailability = (trainerId) => {
    const store = readStore();
    const raw = store[String(trainerId)];
    if (!raw) return null;
    return normalizeAvailability(raw);
};

const setTrainerAvailability = (trainerId, availabilityInput) => {
    const store = readStore();
    store[String(trainerId)] = normalizeAvailability(availabilityInput);
    writeStore(store);
    return store[String(trainerId)];
};

const removeTrainerAvailability = (trainerId) => {
    const store = readStore();
    if (store[String(trainerId)]) {
        delete store[String(trainerId)];
        writeStore(store);
    }
};

const withTrainerAvailability = (trainer) => {
    if (!trainer) return trainer;
    const availability = getTrainerAvailability(trainer.id);
    if (!availability) {
        return {
            ...trainer,
            availabilityDays: [],
            availabilityStart: '',
            availabilityEnd: '',
            availabilityIntervalMinutes: 30
        };
    }
    return { ...trainer, ...availability };
};

const timeToMinutes = (timeString) => {
    const [h, m] = String(timeString).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const isTimeAllowedForTrainer = ({ trainerId, date, time, duration }) => {
    const availability = getTrainerAvailability(trainerId);
    // No availability set = do not block legacy trainers
    if (!availability || !availability.availabilityDays || availability.availabilityDays.length === 0) return true;

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

module.exports = {
    getTrainerAvailability,
    setTrainerAvailability,
    removeTrainerAvailability,
    withTrainerAvailability,
    normalizeAvailability,
    isTimeAllowedForTrainer
};
