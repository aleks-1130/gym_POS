const prisma = require('../../config/prisma');
const {
    normalizeScheduleType,
    parseTimeToMinutes,
    minutesTo12Hour,
    parseOneTimeDate,
    resolveClassSessionStart,
    getDayBounds
} = require('./classScheduleUtils');

const ENROLLED_BOOKING_STATUSES = ['CONFIRMED', 'ATTENDED'];
const COMPLETION_ATTENDEE_STATUSES = ['ATTENDED'];
const CLASS_SESSION_STATUS = {
    SCHEDULED: 'SCHEDULED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED'
};
const START_LEAD_MINUTES = 60;
const AUTO_OPEN_GRACE_MINUTES = 180;
const CLASS_COMPLETE_GRACE_MINUTES = 5;

const toSessionKey = (classId, sessionDate) => {
    const date = new Date(sessionDate);
    if (!classId || Number.isNaN(date.getTime())) return null;
    return `${Number(classId)}::${date.toISOString()}`;
};

const isSameDay = (a, b) => {
    const left = getDayBounds(a);
    const right = getDayBounds(b);
    return Boolean(left && right && left.start.getTime() === right.start.getTime());
};

const resolveSessionTimeline = (cls, sessionDate) => {
    const start = new Date(sessionDate);
    const durationMinutes = Number(cls?.duration || 0);
    if (Number.isNaN(start.getTime()) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

    const end = new Date(start.getTime() + (durationMinutes * 60000));
    const manualStartWindow = {
        start: new Date(start.getTime() - (START_LEAD_MINUTES * 60000)),
        end: new Date(end.getTime() + (AUTO_OPEN_GRACE_MINUTES * 60000))
    };
    const autoOpenWindow = {
        start,
        end: new Date(end.getTime() + (AUTO_OPEN_GRACE_MINUTES * 60000))
    };

    return { start, end, manualStartWindow, autoOpenWindow };
};

const canStartSessionNow = (cls, sessionDate, now = new Date()) => {
    const timeline = resolveSessionTimeline(cls, sessionDate);
    if (!timeline) return false;
    return now >= timeline.manualStartWindow.start && now <= timeline.manualStartWindow.end;
};

const isWithinAutoOpenWindow = (cls, sessionDate, now = new Date()) => {
    const timeline = resolveSessionTimeline(cls, sessionDate);
    if (!timeline) return false;
    return now >= timeline.autoOpenWindow.start && now <= timeline.autoOpenWindow.end;
};

const canCompleteSessionNow = (cls, sessionDate, now = new Date()) => {
    const timeline = resolveSessionTimeline(cls, sessionDate);
    if (!timeline) return false;
    if (!isSameDay(now, sessionDate)) return false;
    const completionReadyAt = new Date(timeline.end.getTime() + (CLASS_COMPLETE_GRACE_MINUTES * 60000));
    return now >= completionReadyAt;
};

const summarizeSessionState = ({ cls, sessionDate, sessionRuntime, completionRecord, now = new Date() }) => {
    if (!sessionDate) {
        return {
            status: CLASS_SESSION_STATUS.SCHEDULED,
            canStart: false,
            canComplete: false,
            reason: 'No valid session date available.',
            startedAt: null,
            completedAt: null
        };
    }

    if (completionRecord || String(sessionRuntime?.status || '').toUpperCase() === CLASS_SESSION_STATUS.COMPLETED) {
        return {
            status: CLASS_SESSION_STATUS.COMPLETED,
            canStart: false,
            canComplete: false,
            reason: 'This session is already completed.',
            startedAt: sessionRuntime?.startedAt || null,
            completedAt: completionRecord?.createdAt || sessionRuntime?.completedAt || null
        };
    }

    if (String(sessionRuntime?.status || '').toUpperCase() === CLASS_SESSION_STATUS.IN_PROGRESS) {
        const sameDay = isSameDay(now, sessionDate);
        const canComplete = canCompleteSessionNow(cls, sessionDate, now);
        return {
            status: CLASS_SESSION_STATUS.IN_PROGRESS,
            canStart: false,
            canComplete,
            reason: !sameDay
                ? 'Class can only be completed on the scheduled session day.'
                : (canComplete ? '' : `Complete class is available after class end + ${CLASS_COMPLETE_GRACE_MINUTES} minutes.`),
            startedAt: sessionRuntime?.startedAt || null,
            completedAt: null
        };
    }

    const autoOpen = isWithinAutoOpenWindow(cls, sessionDate, now);
    const canStart = canStartSessionNow(cls, sessionDate, now);
    const canComplete = canCompleteSessionNow(cls, sessionDate, now);
    return {
        status: autoOpen ? CLASS_SESSION_STATUS.IN_PROGRESS : CLASS_SESSION_STATUS.SCHEDULED,
        canStart,
        canComplete,
        reason: autoOpen
            ? (canComplete ? '' : `Complete class is available after class end + ${CLASS_COMPLETE_GRACE_MINUTES} minutes.`)
            : (canStart
                ? 'Class will automatically start near the scheduled time window.'
                : 'Class start is available near the scheduled time window.'),
        startedAt: null,
        completedAt: null
    };
};

const resolveScheduleFromPayload = ({ time, duration, startTime, endTime }) => {
    const startTimeProvided = startTime !== undefined && startTime !== null && String(startTime).trim() !== '';
    const endTimeProvided = endTime !== undefined && endTime !== null && String(endTime).trim() !== '';

    if (startTimeProvided || endTimeProvided) {
        if (!startTimeProvided || !endTimeProvided) {
            return { error: 'Both start time and end time are required.' };
        }

        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);
        if (startMinutes === null || endMinutes === null) {
            return { error: 'Invalid start/end time format.' };
        }
        if (endMinutes <= startMinutes) {
            return { error: 'End time must be later than start time.' };
        }

        return {
            time: minutesTo12Hour(startMinutes),
            duration: endMinutes - startMinutes
        };
    }

    const parsedStart = parseTimeToMinutes(time);
    const parsedDuration = Number(duration);
    if (parsedStart === null) return { error: 'Invalid class start time.' };
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) return { error: 'Invalid class duration.' };

    return {
        time: minutesTo12Hour(parsedStart),
        duration: parsedDuration
    };
};

const resolveClassMetaFromPayload = ({ payload, existing }) => {
    const scheduleType = normalizeScheduleType(payload?.scheduleType ?? existing?.scheduleType);
    const dayOfWeekInput = payload?.dayOfWeek !== undefined ? payload.dayOfWeek : existing?.dayOfWeek;

    if (scheduleType === 'ONE_TIME') {
        const oneTimeDateRaw = payload?.oneTimeDate !== undefined ? payload.oneTimeDate : existing?.oneTimeDate;
        const parsedOneTimeDate = parseOneTimeDate(oneTimeDateRaw);
        if (!parsedOneTimeDate) {
            return { error: 'One-time class date is required.' };
        }

        return {
            scheduleType,
            oneTimeDate: parsedOneTimeDate,
            dayOfWeek: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(parsedOneTimeDate)
        };
    }

    if (!String(dayOfWeekInput || '').trim()) {
        return { error: 'Class day is required for recurring classes.' };
    }

    return {
        scheduleType,
        oneTimeDate: null,
        dayOfWeek: String(dayOfWeekInput).trim(),
        daysOfWeek: payload?.daysOfWeek ? String(payload.daysOfWeek).trim() : null,
        startDate: payload?.startDate ? new Date(payload.startDate) : undefined,
        endDate: payload?.endDate ? new Date(payload.endDate) : undefined
    };
};

const getAllClasses = async (req, res) => {
    const where = req.user.role === 'TRAINER' ? { trainerId: Number(req.user.trainerId) } : {};
    const now = new Date();

    try {
        const classes = await prisma.class.findMany({
            where,
            include: { trainer: true },
            orderBy: { dayOfWeek: 'asc' }
        });

        const resolvedSessionByClassId = {};
        classes.forEach((cls) => {
            resolvedSessionByClassId[cls.id] = resolveClassSessionStart(cls, {
                now,
                preferToday: req.user.role !== 'MEMBER',
                includePastOneTime: req.user.role !== 'MEMBER'
            });
        });

        const sessionTargets = classes
            .map((cls) => ({
                classId: cls.id,
                sessionDate: resolvedSessionByClassId[cls.id]
            }))
            .filter((entry) => entry.sessionDate);

        const sessionCriteria = sessionTargets.map((entry) => ({
            classId: Number(entry.classId),
            sessionDate: entry.sessionDate
        }));
        const historyCriteria = sessionTargets.map((entry) => ({
            classId: Number(entry.classId),
            date: entry.sessionDate
        }));

        const [sessionRuntimeRows, sessionCompletions] = sessionCriteria.length > 0
            ? await Promise.all([
                prisma.classSession.findMany({
                    where: { OR: sessionCriteria }
                }),
                prisma.classHistory.findMany({
                    where: { OR: historyCriteria }
                })
            ])
            : [[], []];

        const sessionRuntimeMap = new Map();
        sessionRuntimeRows.forEach((row) => {
            const key = toSessionKey(row.classId, row.sessionDate);
            if (!key) return;
            sessionRuntimeMap.set(key, row);
        });

        const sessionCompletionMap = new Map();
        sessionCompletions.forEach((row) => {
            const key = toSessionKey(row.classId, row.date);
            if (!key) return;
            sessionCompletionMap.set(key, row);
        });

        const todayBounds = getDayBounds(now);
        const todayCompletions = todayBounds
            ? await prisma.classHistory.findMany({
                where: {
                    date: { gte: todayBounds.start, lt: todayBounds.end }
                },
                select: { classId: true, attendeeCount: true, commissionAmount: true }
            })
            : [];

        const completionMap = {};
        todayCompletions.forEach((entry) => {
            completionMap[entry.classId] = entry;
        });

        const enriched = await Promise.all(classes.map(async (cls) => {
            const sessionDate = resolvedSessionByClassId[cls.id];
            const sessionKey = toSessionKey(cls.id, sessionDate);
            const sessionRuntime = sessionKey ? sessionRuntimeMap.get(sessionKey) || null : null;
            const sessionCompletion = sessionKey ? sessionCompletionMap.get(sessionKey) || null : null;
            const sessionState = summarizeSessionState({
                cls,
                sessionDate,
                sessionRuntime,
                completionRecord: sessionCompletion,
                now
            });

            const sessionBookings = sessionDate
                ? await prisma.booking.findMany({
                    where: {
                        classId: cls.id,
                        sessionDate: sessionDate
                    },
                    include: { member: true },
                    orderBy: { createdAt: 'desc' }
                })
                : [];

            const enrolled = sessionBookings.filter((booking) => ENROLLED_BOOKING_STATUSES.includes(String(booking.status || '').toUpperCase())).length;

            return {
                ...cls,
                sessionDate,
                enrolled,
                bookings: sessionBookings,
                completedToday: !!completionMap[cls.id],
                todayCompletion: completionMap[cls.id] || null,
                sessionStatus: sessionState.status,
                sessionCanStart: sessionState.canStart,
                sessionCanComplete: sessionState.canComplete,
                sessionControlReason: sessionState.reason,
                sessionStartedAt: sessionState.startedAt,
                sessionCompletedAt: sessionState.completedAt,
                currentSessionCompletion: sessionCompletion
            };
        }));

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch classes', detail: e?.message });
    }
};

const getMyClassHistory = async (req, res) => {
    try {
        const trainerId = Number(req.user?.trainerId);
        if (!trainerId) return res.status(400).json({ error: 'Trainer account is not linked' });

        const limitRaw = Number.parseInt(req.query?.limit, 10);
        const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;

        const history = await prisma.classHistory.findMany({
            where: { trainerId },
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                        capacity: true,
                        time: true,
                        duration: true
                    }
                }
            },
            orderBy: { date: 'desc' },
            take: limit
        });

        const enriched = await Promise.all(history.map(async (entry) => {
            const sessionDayStart = new Date(entry.date);
            sessionDayStart.setHours(0, 0, 0, 0);
            const sessionDayEnd = new Date(sessionDayStart);
            sessionDayEnd.setDate(sessionDayEnd.getDate() + 1);

            const participants = await prisma.booking.findMany({
                where: {
                    classId: entry.classId,
                    sessionDate: {
                        gte: sessionDayStart,
                        lt: sessionDayEnd
                    }
                },
                include: {
                    member: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            return {
                ...entry,
                participants: participants.map((booking) => ({
                    id: booking.id,
                    memberId: booking.memberId,
                    status: booking.status,
                    sessionDate: booking.sessionDate,
                    member: booking.member
                })),
                participantsCount: participants.length
            };
        }));

        return res.json(enriched);
    } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch class history', detail: e?.message });
    }
};

const getClassParticipants = async (req, res) => {
    try {
        const classId = Number(req.params.id);
        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(404).json({ error: 'Class not found' });

        if (req.user.role === 'TRAINER' && cls.trainerId !== Number(req.user.trainerId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const requestedSessionDate = req.query?.sessionDate;
        const resolvedSessionDate = resolveClassSessionStart(cls, {
            now: new Date(),
            requestedSessionDate,
            preferToday: req.user.role !== 'MEMBER',
            includePastOneTime: true
        });

        if (!resolvedSessionDate) {
            return res.json([]);
        }

        const participants = await prisma.booking.findMany({
            where: {
                classId,
                sessionDate: resolvedSessionDate
            },
            include: { member: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(participants);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch participants', detail: e?.message });
    }
};

const createClass = async (req, res) => {
    const { name, trainerId, time, duration, startTime, endTime, capacity, basePay, imageUrl } = req.body;
    const resolvedTrainerId = req.user.role === 'TRAINER' ? Number(req.user.trainerId) : Number(trainerId);
    if (!resolvedTrainerId) return res.status(400).json({ error: 'Trainer is required' });

    try {
        const scheduleMeta = resolveClassMetaFromPayload({ payload: req.body });
        if (scheduleMeta.error) return res.status(400).json({ error: scheduleMeta.error });

        const schedule = resolveScheduleFromPayload({ time, duration, startTime, endTime });
        if (schedule.error) return res.status(400).json({ error: schedule.error });

        const gymClass = await prisma.class.create({
            data: {
                name,
                trainerId: resolvedTrainerId,
                scheduleType: scheduleMeta.scheduleType,
                oneTimeDate: scheduleMeta.oneTimeDate,
                dayOfWeek: scheduleMeta.dayOfWeek,
                time: schedule.time,
                duration: Number(schedule.duration),
                capacity: Number(capacity),
                basePay: basePay !== undefined && basePay !== '' ? Number(basePay) : 0,
                imageUrl: imageUrl !== undefined && String(imageUrl).trim() !== '' ? String(imageUrl).trim() : null,
                daysOfWeek: scheduleMeta.daysOfWeek,
                startDate: scheduleMeta.startDate,
                endDate: scheduleMeta.endDate
            }
        });
        res.json(gymClass);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updateClass = async (req, res) => {
    const classId = Number(req.params.id);
    const { name, trainerId, time, duration, startTime, endTime, capacity, basePay, imageUrl } = req.body;
    try {
        const existing = await prisma.class.findUnique({ where: { id: classId } });
        if (!existing) {
            return res.status(404).json({ error: 'Class not found' });
        }

        if (req.user.role === 'TRAINER' && existing.trainerId !== Number(req.user.trainerId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const scheduleMeta = resolveClassMetaFromPayload({ payload: req.body, existing });
        if (scheduleMeta.error) return res.status(400).json({ error: scheduleMeta.error });

        const scheduleFieldsProvided = (
            time !== undefined ||
            duration !== undefined ||
            startTime !== undefined ||
            endTime !== undefined
        );

        let schedulePatch = {};
        if (scheduleFieldsProvided) {
            const fallbackTime = time !== undefined && time !== '' ? time : existing.time;
            const fallbackDuration = duration !== undefined && duration !== '' ? duration : existing.duration;
            const normalizedSchedule = resolveScheduleFromPayload({
                time: fallbackTime,
                duration: fallbackDuration,
                startTime,
                endTime
            });
            if (normalizedSchedule.error) {
                return res.status(400).json({ error: normalizedSchedule.error });
            }
            schedulePatch = {
                time: normalizedSchedule.time,
                duration: Number(normalizedSchedule.duration)
            };
        }

        const resolvedTrainerId = req.user.role === 'TRAINER'
            ? Number(req.user.trainerId)
            : (trainerId !== undefined && trainerId !== '' ? Number(trainerId) : undefined);
        const normalizedImageUrl = imageUrl !== undefined
            ? (String(imageUrl).trim() ? String(imageUrl).trim() : null)
            : undefined;

        const gymClass = await prisma.class.update({
            where: { id: classId },
            data: {
                name,
                scheduleType: scheduleMeta.scheduleType,
                oneTimeDate: scheduleMeta.oneTimeDate,
                dayOfWeek: scheduleMeta.dayOfWeek,
                ...schedulePatch,
                capacity: capacity !== undefined && capacity !== '' ? Number(capacity) : undefined,
                trainerId: resolvedTrainerId,
                basePay: basePay !== undefined && basePay !== '' ? Number(basePay) : undefined,
                daysOfWeek: scheduleMeta.daysOfWeek,
                startDate: scheduleMeta.startDate,
                endDate: scheduleMeta.endDate,
                ...(imageUrl !== undefined ? { imageUrl: normalizedImageUrl } : {})
            }
        });
        res.json(gymClass);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update class', detail: e?.message });
    }
};

const deleteClass = async (req, res) => {
    const classId = Number(req.params.id);
    try {
        if (req.user.role === 'TRAINER') {
            const existing = await prisma.class.findUnique({ where: { id: classId } });
            if (!existing || existing.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        await prisma.$transaction(async (tx) => {
            await tx.booking.deleteMany({ where: { classId } });
            await tx.classHistory.deleteMany({ where: { classId } });
            await tx.classSession.deleteMany({ where: { classId } });
            await tx.class.delete({ where: { id: classId } });
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete class', detail: e?.message });
    }
};

const updateAttendeeStatus = async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: 'Trainer account is not linked' });
        const classId = Number(req.params.classId);
        const bookingId = Number(req.params.bookingId);
        const normalizedStatus = String(req.body?.status || '').toUpperCase();
        const allowed = ['ATTENDED', 'NO_SHOW'];
        if (!allowed.includes(normalizedStatus)) {
            return res.status(400).json({ error: 'Invalid status. Allowed values: ATTENDED, NO_SHOW' });
        }

        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls || cls.trainerId !== Number(trainerId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.classId !== classId) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const bookingSessionDate = booking.sessionDate
            ? new Date(booking.sessionDate)
            : resolveClassSessionStart(cls, {
                now: new Date(),
                preferToday: true,
                includePastOneTime: true
            });
        if (!bookingSessionDate || Number.isNaN(bookingSessionDate.getTime())) {
            return res.status(400).json({ error: 'Booking has no valid session date.' });
        }

        const now = new Date();
        if (!isSameDay(now, bookingSessionDate)) {
            return res.status(409).json({ error: 'Attendance can only be updated on the scheduled class day.' });
        }

        const sessionRuntime = await prisma.classSession.findUnique({
            where: {
                classId_sessionDate: {
                    classId,
                    sessionDate: bookingSessionDate
                }
            }
        });

        if (String(sessionRuntime?.status || '').toUpperCase() === CLASS_SESSION_STATUS.COMPLETED) {
            return res.status(409).json({ error: 'Attendance is locked because this class session is completed.' });
        }

        const timeline = resolveSessionTimeline(cls, bookingSessionDate);
        if (!timeline) {
            return res.status(400).json({ error: 'Invalid class timeline.' });
        }

        const withinAttendanceWindow = now >= timeline.start && now <= timeline.autoOpenWindow.end;
        if (!withinAttendanceWindow) {
            return res.status(409).json({ error: 'Attendance can only be updated while class is in progress.' });
        }

        const updated = await prisma.booking.update({
            where: { id: bookingId },
            data: { status: normalizedStatus }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update attendee status', detail: e?.message });
    }
};

const startClassSession = async (req, res) => {
    const classId = Number(req.params.id);
    const requestedSessionDate = req.body?.sessionDate || req.query?.sessionDate;
    const now = new Date();

    try {
        const cls = await prisma.class.findUnique({
            where: { id: classId },
            include: { trainer: true }
        });

        if (!cls) return res.status(404).json({ error: 'Class not found' });
        if (req.user.role === 'TRAINER' && Number(cls.trainerId) !== Number(req.user.trainerId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const sessionDate = resolveClassSessionStart(cls, {
            now,
            requestedSessionDate,
            preferToday: true,
            includePastOneTime: true
        });
        if (!sessionDate) {
            return res.status(400).json({ error: 'No valid class session found to start.' });
        }

        if (req.user.role === 'TRAINER' && !canStartSessionNow(cls, sessionDate, now)) {
            return res.status(409).json({
                error: 'Class can be started only near its scheduled time window.'
            });
        }

        const sessionBounds = getDayBounds(sessionDate);
        if (!sessionBounds) {
            return res.status(400).json({ error: 'Invalid session date' });
        }

        const existingCompletion = await prisma.classHistory.findFirst({
            where: {
                classId,
                date: { gte: sessionBounds.start, lt: sessionBounds.end }
            }
        });

        if (existingCompletion) {
            return res.status(409).json({ error: 'This class has already been completed for this session date' });
        }

        const existingSessionRuntime = await prisma.classSession.findUnique({
            where: {
                classId_sessionDate: {
                    classId,
                    sessionDate
                }
            }
        });

        if (String(existingSessionRuntime?.status || '').toUpperCase() === CLASS_SESSION_STATUS.COMPLETED) {
            return res.status(409).json({ error: 'This class session is already completed.' });
        }

        const runtime = await prisma.classSession.upsert({
            where: {
                classId_sessionDate: {
                    classId,
                    sessionDate
                }
            },
            update: {
                status: CLASS_SESSION_STATUS.IN_PROGRESS,
                startedAt: existingSessionRuntime?.startedAt || now,
                isAutoStarted: false,
                startedByRole: req.user.role
            },
            create: {
                classId,
                trainerId: Number(cls.trainerId),
                sessionDate,
                status: CLASS_SESSION_STATUS.IN_PROGRESS,
                startedAt: now,
                isAutoStarted: false,
                startedByRole: req.user.role
            }
        });

        res.json({ success: true, sessionDate, session: runtime });
    } catch (e) {
        console.error('Start Class Error:', e);
        res.status(500).json({ error: 'Failed to start class session' });
    }
};

const completeClass = async (req, res) => {
    const classId = Number(req.params.id);
    const requestedSessionDate = req.body?.sessionDate;
    const now = new Date();

    try {
        const cls = await prisma.class.findUnique({
            where: { id: classId },
            include: { trainer: true }
        });

        if (!cls) return res.status(404).json({ error: 'Class not found' });
        if (req.user.role === 'TRAINER' && Number(cls.trainerId) !== Number(req.user.trainerId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const sessionDate = resolveClassSessionStart(cls, {
            now,
            requestedSessionDate,
            preferToday: true,
            includePastOneTime: true
        });
        if (!sessionDate) {
            return res.status(400).json({ error: 'No valid class session found to complete.' });
        }

        if (!isSameDay(now, sessionDate)) {
            return res.status(409).json({
                error: 'Class can only be completed on its scheduled session day.'
            });
        }

        const timeline = resolveSessionTimeline(cls, sessionDate);
        if (!timeline) {
            return res.status(400).json({ error: 'Invalid class session timeline.' });
        }
        const completionReadyAt = new Date(timeline.end.getTime() + (CLASS_COMPLETE_GRACE_MINUTES * 60000));
        if (now < completionReadyAt) {
            return res.status(409).json({
                error: `Class can be completed only after class end (+${CLASS_COMPLETE_GRACE_MINUTES} min grace period).`
            });
        }

        const sessionBounds = getDayBounds(sessionDate);
        if (!sessionBounds) {
            return res.status(400).json({ error: 'Invalid session date' });
        }

        const existingCompletion = await prisma.classHistory.findFirst({
            where: {
                classId,
                date: { gte: sessionBounds.start, lt: sessionBounds.end }
            }
        });

        if (existingCompletion) {
            return res.status(409).json({ error: 'This class has already been completed for this session date' });
        }

        let existingSessionRuntime = await prisma.classSession.findUnique({
            where: {
                classId_sessionDate: {
                    classId,
                    sessionDate
                }
            }
        });

        const normalizedRuntimeStatus = String(existingSessionRuntime?.status || '').toUpperCase();
        if (normalizedRuntimeStatus === CLASS_SESSION_STATUS.COMPLETED) {
            return res.status(409).json({ error: 'This class session is already completed.' });
        }

        if (normalizedRuntimeStatus === CLASS_SESSION_STATUS.SCHEDULED || !existingSessionRuntime) {
            existingSessionRuntime = await prisma.classSession.upsert({
                where: {
                    classId_sessionDate: {
                        classId,
                        sessionDate
                    }
                },
                update: {
                    status: CLASS_SESSION_STATUS.IN_PROGRESS,
                    startedAt: existingSessionRuntime?.startedAt || now,
                    isAutoStarted: true,
                    startedByRole: existingSessionRuntime?.startedByRole || 'SYSTEM'
                },
                create: {
                    classId,
                    trainerId: Number(cls.trainerId),
                    sessionDate,
                    status: CLASS_SESSION_STATUS.IN_PROGRESS,
                    startedAt: now,
                    isAutoStarted: true,
                    startedByRole: 'SYSTEM'
                }
            });
        }

        const attendees = await prisma.booking.count({
            where: {
                classId,
                sessionDate,
                status: { in: COMPLETION_ATTENDEE_STATUSES }
            }
        });

        const [history, runtime] = await prisma.$transaction([
            prisma.classHistory.create({
                data: {
                    classId,
                    trainerId: Number(cls.trainerId),
                    date: sessionDate,
                    attendeeCount: attendees,
                    commissionAmount: cls.basePay ?? 0,
                    commissionPaid: false
                }
            }),
            prisma.classSession.upsert({
                where: {
                    classId_sessionDate: {
                        classId,
                        sessionDate
                    }
                },
                update: {
                    status: CLASS_SESSION_STATUS.COMPLETED,
                    completedAt: now,
                    completedByRole: req.user.role
                },
                create: {
                    classId,
                    trainerId: Number(cls.trainerId),
                    sessionDate,
                    status: CLASS_SESSION_STATUS.COMPLETED,
                    startedAt: now,
                    completedAt: now,
                    isAutoStarted: true,
                    startedByRole: 'SYSTEM',
                    completedByRole: req.user.role
                }
            })
        ]);

        res.json({ ...history, sessionDate, session: runtime });
    } catch (e) {
        console.error('Complete Class Error:', e);
        res.status(500).json({ error: 'Failed to complete class' });
    }
};

const overrideCompleteClass = async (req, res) => {
    const classId = Number(req.params.id);
    const requestedSessionDate = req.body?.sessionDate;
    const overrideReason = String(req.body?.reason || '').trim();
    const now = new Date();

    try {
        const cls = await prisma.class.findUnique({
            where: { id: classId },
            include: { trainer: true }
        });

        if (!cls) return res.status(404).json({ error: 'Class not found' });

        const sessionDate = resolveClassSessionStart(cls, {
            now,
            requestedSessionDate,
            preferToday: false,
            includePastOneTime: true
        });
        if (!sessionDate) {
            return res.status(400).json({ error: 'No valid class session found to override complete.' });
        }
        if (sessionDate > now) {
            return res.status(400).json({ error: 'Cannot override-complete a future class session.' });
        }

        const sessionBounds = getDayBounds(sessionDate);
        if (!sessionBounds) {
            return res.status(400).json({ error: 'Invalid session date' });
        }

        const existingCompletion = await prisma.classHistory.findFirst({
            where: {
                classId,
                date: { gte: sessionBounds.start, lt: sessionBounds.end }
            }
        });

        if (existingCompletion) {
            return res.status(409).json({ error: 'This class has already been completed for this session date' });
        }

        const attendees = await prisma.booking.count({
            where: {
                classId,
                sessionDate,
                status: { in: COMPLETION_ATTENDEE_STATUSES }
            }
        });

        const [history, runtime] = await prisma.$transaction([
            prisma.classHistory.create({
                data: {
                    classId,
                    trainerId: Number(cls.trainerId),
                    date: sessionDate,
                    attendeeCount: attendees,
                    commissionAmount: cls.basePay ?? 0,
                    commissionPaid: false
                }
            }),
            prisma.classSession.upsert({
                where: {
                    classId_sessionDate: {
                        classId,
                        sessionDate
                    }
                },
                update: {
                    status: CLASS_SESSION_STATUS.COMPLETED,
                    startedAt: now,
                    completedAt: now,
                    isAutoStarted: true,
                    startedByRole: 'SYSTEM',
                    completedByRole: req.user.role,
                    completionNote: overrideReason || 'Admin override completion'
                },
                create: {
                    classId,
                    trainerId: Number(cls.trainerId),
                    sessionDate,
                    status: CLASS_SESSION_STATUS.COMPLETED,
                    startedAt: now,
                    completedAt: now,
                    isAutoStarted: true,
                    startedByRole: 'SYSTEM',
                    completedByRole: req.user.role,
                    completionNote: overrideReason || 'Admin override completion'
                }
            })
        ]);

        res.json({ ...history, sessionDate, session: runtime, override: true });
    } catch (e) {
        console.error('Override Complete Class Error:', e);
        res.status(500).json({ error: 'Failed to override-complete class' });
    }
};

module.exports = {
    getAllClasses,
    getMyClassHistory,
    getClassParticipants,
    createClass,
    updateClass,
    deleteClass,
    updateAttendeeStatus,
    startClassSession,
    completeClass,
    overrideCompleteClass
};
