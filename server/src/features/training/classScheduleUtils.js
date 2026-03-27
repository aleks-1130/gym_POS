const DAY_NAME_MAP = {
    MON: 'MONDAY',
    MONDAY: 'MONDAY',
    TUE: 'TUESDAY',
    TUES: 'TUESDAY',
    TUESDAY: 'TUESDAY',
    WED: 'WEDNESDAY',
    WEDNESDAY: 'WEDNESDAY',
    THU: 'THURSDAY',
    THUR: 'THURSDAY',
    THURS: 'THURSDAY',
    THURSDAY: 'THURSDAY',
    FRI: 'FRIDAY',
    FRIDAY: 'FRIDAY',
    SAT: 'SATURDAY',
    SATURDAY: 'SATURDAY',
    SUN: 'SUNDAY',
    SUNDAY: 'SUNDAY'
};

const WEEKDAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const normalizeDayToken = (value) => {
    const key = String(value || '').trim().toUpperCase().replace(/\./g, '');
    return DAY_NAME_MAP[key] || null;
};

const normalizeScheduleType = (value) => {
    const token = String(value || 'RECURRING').trim().toUpperCase();
    return token === 'ONE_TIME' ? 'ONE_TIME' : 'RECURRING';
};

const parseClassDays = (dayOfWeek) =>
    String(dayOfWeek || '')
        .split(/,|\/|&|\band\b/gi)
        .map(normalizeDayToken)
        .filter(Boolean);

const parseTimeToMinutes = (timeValue) => {
    const raw = String(timeValue || '').trim().toUpperCase();
    if (!raw) return null;

    const hhmm24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (hhmm24) {
        return (Number(hhmm24[1]) * 60) + Number(hhmm24[2]);
    }

    const hhmm12 = raw.match(/^(0?\d|1[0-2]):([0-5]\d)\s*(AM|PM)$/);
    if (!hhmm12) return null;

    let hours = Number(hhmm12[1]) % 12;
    const minutes = Number(hhmm12[2]);
    if (hhmm12[3] === 'PM') {
        hours += 12;
    }
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

const getWeekdayName = (date) => WEEKDAY_NAMES[new Date(date).getDay()];

const toDayStart = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
};

const getDayBounds = (value) => {
    const start = toDayStart(value);
    if (!start) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

const buildDateAtMinutes = (baseDate, minutes) => {
    const date = toDayStart(baseDate);
    if (!date || !Number.isFinite(minutes)) return null;
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return date;
};

const parseOneTimeDate = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
        const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (ymd) {
            const parsedLocal = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
            if (!Number.isNaN(parsedLocal.getTime())) {
                parsedLocal.setHours(0, 0, 0, 0);
                return parsedLocal;
            }
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
};

const resolveClassSessionStart = (cls, options = {}) => {
    const {
        now = new Date(),
        requestedSessionDate,
        preferToday = false,
        includePastOneTime = false,
        currentWeekOnly = false,
        anchorDate = null // NEW: allows anchoring relative to a different week
    } = options;

    const referenceDate = anchorDate ? new Date(anchorDate) : now;

    const startMinutes = parseTimeToMinutes(cls?.time);
    const durationMinutes = Number(cls?.duration || 0);
    if (startMinutes === null || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

    const scheduleType = normalizeScheduleType(cls?.scheduleType);

    if (scheduleType === 'ONE_TIME') {
        const oneTimeBase = parseOneTimeDate(cls?.oneTimeDate);
        if (!oneTimeBase) return null;

        const oneTimeStart = buildDateAtMinutes(oneTimeBase, startMinutes);
        if (!oneTimeStart) return null;

        if (requestedSessionDate) {
            const requestedBase = parseOneTimeDate(requestedSessionDate);
            if (!requestedBase) return null;
            if (requestedBase.getTime() !== oneTimeBase.getTime()) return null;
            return oneTimeStart;
        }

        const oneTimeEnd = new Date(oneTimeStart.getTime() + (durationMinutes * 60000));
        if (!includePastOneTime && oneTimeEnd < now) return null;
        return oneTimeStart;
    }

    const classDays = parseClassDays(cls?.daysOfWeek || cls?.dayOfWeek);
    if (!classDays.length) return null;

    const startDate = cls?.startDate ? new Date(cls.startDate) : null;
    const endDate = cls?.endDate ? new Date(cls.endDate) : null;

    if (requestedSessionDate) {
        const requestedBase = toDayStart(requestedSessionDate);
        if (!requestedBase) return null;
        
        // Date range check
        if (startDate && requestedBase < toDayStart(startDate)) return null;
        if (endDate && requestedBase > toDayStart(endDate)) return null;

        const requestedStart = buildDateAtMinutes(requestedBase, startMinutes);
        if (!requestedStart) return null;

        const requestedDay = normalizeDayToken(getWeekdayName(requestedStart));
        if (!requestedDay || !classDays.includes(requestedDay)) return null;
        return requestedStart;
    }


    const todayStart = toDayStart(now);
    if (!todayStart) return null;

    const searchStart = new Date(todayStart);
    let searchLimit = 28;

    if (currentWeekOnly) {
        // Calculate bounds for the ISO week containing referenceDate
        const weekStart = new Date(referenceDate);
        weekStart.setHours(0, 0, 0, 0);
        const day = weekStart.getDay();
        const diff = (day + 6) % 7;
        weekStart.setDate(weekStart.getDate() - diff);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        // Helper to find the first session date for a recurring class within a given week
        const findSessionInWeek = (classDetails, weekStartDate) => {
            const classDaysInWeek = parseClassDays(classDetails?.daysOfWeek || classDetails?.dayOfWeek);
            if (!classDaysInWeek.length) return null;

            const startMinutesInWeek = parseTimeToMinutes(classDetails?.time);
            if (startMinutesInWeek === null) return null;

            for (let offset = 0; offset < 7; offset += 1) {
                const candidateDay = new Date(weekStartDate);
                candidateDay.setDate(weekStartDate.getDate() + offset);

                const candidateToken = normalizeDayToken(getWeekdayName(candidateDay));
                if (candidateToken && classDaysInWeek.includes(candidateToken)) {
                    const candidateStart = buildDateAtMinutes(candidateDay, startMinutesInWeek);
                    // Check against class start/end dates if they exist
                    if (startDate && candidateStart < toDayStart(startDate)) continue;
                    if (endDate && candidateStart > toDayStart(endDate)) continue;
                    return candidateStart;
                }
            }
            return null;
        };

        const candidate = findSessionInWeek(cls, weekStart);
        if (candidate) {
            // In currentWeekOnly mode relative to an anchor, we usually want that week's session
            // even if it has passed (so UI can show "Ended").
            if (candidate < weekEnd) {
                return candidate;
            }
        }
        return null;
    }

    for (let offset = 0; offset < searchLimit; offset += 1) {
        const candidateDay = new Date(searchStart);
        candidateDay.setDate(candidateDay.getDate() + offset);

        // Date range check
        if (startDate && candidateDay < toDayStart(startDate)) continue;
        if (endDate && candidateDay > toDayStart(endDate)) continue;

        const candidateToken = normalizeDayToken(getWeekdayName(candidateDay));
        if (!candidateToken || !classDays.includes(candidateToken)) continue;

        const candidateStart = buildDateAtMinutes(candidateDay, startMinutes);
        const candidateEnd = new Date(candidateStart.getTime() + (durationMinutes * 60000));
        
        // REFINEMENT: If currentWeekOnly is true, we want the session for the specific day 
        // in the current week, even if it's in the past. This allows the UI to show "Class Ended".
        if (currentWeekOnly) return candidateStart;

        // Use candidateEnd to determine if the session is still "available" (either upcoming or in-progress)
        if (candidateEnd >= now) return candidateStart;
    }

    return null;
};

const resolveClassSessionsInRange = (cls, startRange, endRange) => {
    const dates = [];
    const startRangeDate = new Date(startRange);
    const endRangeDate = new Date(endRange);
    
    if (Number.isNaN(startRangeDate.getTime()) || Number.isNaN(endRangeDate.getTime())) return [];

    const startMinutes = parseTimeToMinutes(cls?.time);
    if (startMinutes === null) return [];

    const scheduleType = normalizeScheduleType(cls?.scheduleType);
    if (scheduleType === 'ONE_TIME') {
        const oneTimeBase = parseOneTimeDate(cls?.oneTimeDate);
        if (!oneTimeBase) return [];
        const oneTimeStart = buildDateAtMinutes(oneTimeBase, startMinutes);
        if (oneTimeStart >= startRangeDate && oneTimeStart <= endRangeDate) {
            dates.push(oneTimeStart);
        }
    } else {
        const classDays = parseClassDays(cls?.daysOfWeek || cls?.dayOfWeek);
        if (!classDays.length) return [];

        const clsStart = cls?.startDate ? new Date(cls.startDate) : null;
        const clsEnd = cls?.endDate ? new Date(cls.endDate) : null;

        // Iterate through each day in range
        let current = new Date(startRangeDate);
        current.setHours(0, 0, 0, 0);
        
        while (current <= endRangeDate) {
            // Range check
            const dayStart = toDayStart(current);
            if ((clsStart && dayStart < toDayStart(clsStart)) || (clsEnd && dayStart > toDayStart(clsEnd))) {
                current.setDate(current.getDate() + 1);
                continue;
            }

            const dayToken = normalizeDayToken(getWeekdayName(current));
            if (dayToken && classDays.includes(dayToken)) {
                const sessionStart = buildDateAtMinutes(current, startMinutes);
                if (sessionStart >= startRangeDate && sessionStart <= endRangeDate) {
                    dates.push(sessionStart);
                }
            }
            current.setDate(current.getDate() + 1);
        }
    }

    return dates;
};

const resolveCompletionWindow = (cls, sessionStart, now = new Date()) => {
    if (!sessionStart || Number.isNaN(new Date(sessionStart).getTime())) {
        return {
            allowed: false,
            error: 'Class session date is invalid.'
        };
    }

    const durationMinutes = Number(cls?.duration || 0);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return {
            allowed: false,
            error: 'Class duration is invalid.'
        };
    }

    const sessionStartDate = new Date(sessionStart);
    const sessionEndDate = new Date(sessionStartDate.getTime() + (durationMinutes * 60000));
    const nowDate = new Date(now);

    const nowBounds = getDayBounds(nowDate);
    const sessionBounds = getDayBounds(sessionStartDate);
    if (!nowBounds || !sessionBounds || nowBounds.start.getTime() !== sessionBounds.start.getTime()) {
        return {
            allowed: false,
            error: `Class can only be completed on ${sessionStartDate.toLocaleDateString()}.`
        };
    }

    if (nowDate < sessionStartDate || nowDate > sessionEndDate) {
        const startLabel = minutesTo12Hour((sessionStartDate.getHours() * 60) + sessionStartDate.getMinutes());
        const endLabel = minutesTo12Hour((sessionEndDate.getHours() * 60) + sessionEndDate.getMinutes());
        return {
            allowed: false,
            error: `Class can only be completed during its schedule (${startLabel} - ${endLabel}).`
        };
    }

    return { allowed: true };
};

module.exports = {
    normalizeDayToken,
    normalizeScheduleType,
    parseClassDays,
    parseTimeToMinutes,
    minutesTo12Hour,
    getWeekdayName,
    toDayStart,
    getDayBounds,
    buildDateAtMinutes,
    parseOneTimeDate,
    resolveClassSessionStart,
    resolveClassSessionsInRange, // Added
    resolveCompletionWindow
};
