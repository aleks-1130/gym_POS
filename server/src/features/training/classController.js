const prisma = require('../../config/prisma');
const {
    normalizeScheduleType,
    parseTimeToMinutes,
    minutesTo12Hour,
    parseOneTimeDate,
    resolveClassSessionStart,
    resolveCompletionWindow,
    getDayBounds
} = require('./classScheduleUtils');

const ACTIVE_BOOKING_STATUSES = ['CONFIRMED', 'ATTENDED'];

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
        dayOfWeek: String(dayOfWeekInput).trim()
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
            const sessionDate = resolveClassSessionStart(cls, {
                now,
                preferToday: req.user.role === 'TRAINER',
                includePastOneTime: req.user.role !== 'MEMBER'
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

            const enrolled = sessionBookings.filter((booking) => ACTIVE_BOOKING_STATUSES.includes(String(booking.status || '').toUpperCase())).length;

            return {
                ...cls,
                sessionDate,
                enrolled,
                bookings: sessionBookings,
                completedToday: !!completionMap[cls.id],
                todayCompletion: completionMap[cls.id] || null
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
            preferToday: req.user.role === 'TRAINER',
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
                imageUrl: imageUrl !== undefined && String(imageUrl).trim() !== '' ? String(imageUrl).trim() : null
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
        const { status } = req.body;
        const allowed = ['CONFIRMED', 'ATTENDED', 'CANCELLED'];
        if (!allowed.includes(String(status).toUpperCase())) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls || cls.trainerId !== Number(trainerId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.classId !== classId) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const updated = await prisma.booking.update({
            where: { id: bookingId },
            data: { status: String(status).toUpperCase() }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update attendee status', detail: e?.message });
    }
};

const completeClass = async (req, res) => {
    const classId = Number(req.params.id);
    const requestedSessionDate = req.body?.sessionDate;

    try {
        const cls = await prisma.class.findUnique({
            where: { id: classId },
            include: { trainer: true }
        });

        if (!cls) return res.status(404).json({ error: 'Class not found' });

        const trainerId = req.user.trainerId ? Number(req.user.trainerId) : cls.trainerId;
        if (!trainerId) return res.status(400).json({ error: 'No trainer assigned to this class' });
        if (req.user.role === 'TRAINER' && Number(cls.trainerId) !== Number(req.user.trainerId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const sessionDate = resolveClassSessionStart(cls, {
            now: new Date(),
            requestedSessionDate,
            preferToday: true,
            includePastOneTime: true
        });
        if (!sessionDate) {
            return res.status(400).json({ error: 'No valid class session found to complete.' });
        }

        const completionWindow = resolveCompletionWindow(cls, sessionDate, new Date());
        if (!completionWindow.allowed) {
            return res.status(400).json({ error: completionWindow.error });
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
            return res.status(400).json({ error: 'This class has already been completed for this session date' });
        }

        const attendees = await prisma.booking.count({
            where: {
                classId,
                sessionDate,
                status: { in: ACTIVE_BOOKING_STATUSES }
            }
        });

        const history = await prisma.classHistory.create({
            data: {
                classId,
                trainerId: Number(trainerId),
                date: sessionDate,
                attendeeCount: attendees,
                commissionAmount: cls.basePay ?? 0,
                commissionPaid: false
            }
        });

        res.json({ ...history, sessionDate });
    } catch (e) {
        console.error('Complete Class Error:', e);
        res.status(500).json({ error: 'Failed to complete class' });
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
    completeClass
};
