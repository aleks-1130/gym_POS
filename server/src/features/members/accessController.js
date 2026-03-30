const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const ACCESS_QR_SECRET = process.env.ACCESS_QR_SECRET || process.env.JWT_SECRET;
const ACCESS_QR_TTL_SECONDS = Number(process.env.ACCESS_QR_TTL_SECONDS || 45);
const ACCESS_ALLOW_STATIC_IDS = String(process.env.ACCESS_ALLOW_STATIC_IDS || '').toLowerCase() === 'true';
const usedQrJti = new Map();
let latestAccessEvent = null;

const accessLogInclude = {
    member: true,
    trainer: true
};

const pruneUsedQrTokens = () => {
    const now = Date.now();
    for (const [jti, expMs] of usedQrJti.entries()) {
        if (!Number.isFinite(expMs) || expMs <= now) usedQrJti.delete(jti);
    }
};

const setLatestAccessEvent = ({ status = 'DENIED', reason = null, log = null }) => {
    latestAccessEvent = {
        id: log?.id ? `log-${log.id}` : `evt-${Date.now()}`,
        type: log ? 'LOG' : 'ERROR',
        status,
        reason,
        checkIn: log?.checkIn || new Date().toISOString(),
        log
    };
};

const isMemberExpired = (member, now = new Date()) => {
    if (!member) return true;
    if (String(member.status || '').toUpperCase() === 'EXPIRED') return true;
    if (!member.expiryDate) return false;

    const expiryDate = new Date(member.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) return true;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    return expiryDate < todayStart;
};

const isMemberFreezed = (member) => {
    if (!member) return false;
    const normalizedStatus = String(member.status || '').toUpperCase();
    return normalizedStatus === 'FREEZED' || normalizedStatus === 'FROZEN';
};

const issueDynamicQrToken = ({ entity, id }) => {
    const jti = randomUUID();
    const token = jwt.sign(
        { typ: 'ACCESS_QR', entity, id: Number(id), jti },
        ACCESS_QR_SECRET,
        { expiresIn: ACCESS_QR_TTL_SECONDS }
    );
    const decoded = jwt.decode(token);
    const expMs = Number(decoded?.exp) * 1000;

    return {
        token,
        qrValue: `ACCESS:${token}`,
        expiresAt: Number.isFinite(expMs) ? new Date(expMs).toISOString() : null,
        refreshAfterSeconds: Math.max(5, ACCESS_QR_TTL_SECONDS - 10)
    };
};

const resolveIdsFromQrToken = (rawToken) => {
    const clean = String(rawToken || '').trim().replace(/^ACCESS:/i, '');
    if (!clean) {
        throw new Error('INVALID_QR_TOKEN');
    }
    if (!ACCESS_QR_SECRET) {
        throw new Error('MISSING_QR_SECRET');
    }

    const payload = jwt.verify(clean, ACCESS_QR_SECRET, { algorithms: ['HS256'] });
    if (payload?.typ !== 'ACCESS_QR' || !payload?.entity || !payload?.id || !payload?.jti) {
        throw new Error('INVALID_QR_TOKEN');
    }

    pruneUsedQrTokens();
    if (usedQrJti.has(payload.jti)) {
        throw new Error('QR_TOKEN_ALREADY_USED');
    }

    const expMs = Number(payload?.exp) * 1000;
    usedQrJti.set(payload.jti, Number.isFinite(expMs) ? expMs : Date.now() + 60_000);

    if (payload.entity === 'MEMBER') {
        return { memberId: Number(payload.id), trainerId: null };
    }
    if (payload.entity === 'TRAINER') {
        return { memberId: null, trainerId: Number(payload.id) };
    }
    throw new Error('INVALID_QR_ENTITY');
};

const createMemberAccessLog = async (parsedMemberId, gymIdOverride = null) => {
    const member = await prisma.member.findUnique({
        where: { id: parsedMemberId },
        select: { id: true, status: true, expiryDate: true, freezeStartDate: true, freezeEndDate: true, gymId: true, tenantId: true }
    });
    if (!member) {
        return { error: { status: 404, payload: { error: "Member not found" } } };
    }

    const now = new Date();
    const isExpired = isMemberExpired(member, now);
    const isFrozen = isMemberFreezed(member, now);
    const isActive = String(member.status || '').toUpperCase() === 'ACTIVE';
    const isAllowed = isActive && !isExpired && !isFrozen;

    const log = await prisma.accessLog.create({
        data: {
            memberId: parsedMemberId,
            status: isAllowed ? 'ALLOWED' : 'DENIED',
            checkIn: new Date(),
            gymId: gymIdOverride || member.gymId,
            tenantId: member.tenantId
        },
        include: accessLogInclude
    });

    if (!isAllowed) {
        let reason = "Membership is not eligible for access";
        if (isExpired) {
            reason = "Membership is expired. Renew first before scanning for entry.";
        } else if (isFrozen) {
            reason = "Membership is freezed. Access is disabled while freeze is active.";
        } else if (!isActive) {
            reason = "Membership is not active for entry.";
        }

        return {
            error: {
                status: 403,
                payload: {
                    ...log,
                    reason,
                    error: reason
                }
            }
        };
    }
    return { log };
};

const createTrainerAccessLog = async (parsedTrainerId, gymIdOverride = null) => {
    const trainer = await prisma.trainer.findUnique({
        where: { id: parsedTrainerId },
        select: { id: true, gymId: true, tenantId: true }
    });
    if (!trainer) {
        return { error: { status: 404, payload: { error: "Trainer not found" } } };
    }

    const log = await prisma.accessLog.create({
        data: {
            trainerId: parsedTrainerId,
            status: 'ALLOWED',
            checkIn: new Date(),
            gymId: gymIdOverride || trainer.gymId,
            tenantId: trainer.tenantId
        },
        include: accessLogInclude
    });

    return { log };
};

const getDynamicQrToken = async (req, res) => {
    try {
        if (!ACCESS_QR_SECRET) {
            return res.status(500).json({ error: "QR token secret is not configured" });
        }

        if (req.user?.role === 'MEMBER') {
            return res.json({
                entity: 'MEMBER',
                id: Number(req.user.id),
                ...issueDynamicQrToken({ entity: 'MEMBER', id: req.user.id })
            });
        }

        if (req.user?.role === 'TRAINER') {
            if (!req.user?.trainerId) {
                return res.status(400).json({ error: "Trainer account is not linked" });
            }
            return res.json({
                entity: 'TRAINER',
                id: Number(req.user.trainerId),
                ...issueDynamicQrToken({ entity: 'TRAINER', id: req.user.trainerId })
            });
        }

        return res.status(403).json({ error: "Only member and trainer roles can request dynamic QR" });
    } catch (e) {
        return res.status(500).json({ error: "Failed to generate dynamic QR token" });
    }
};

const getLatestAccessEvent = async (req, res) => {
    try {
        if (latestAccessEvent) {
            return res.json(latestAccessEvent);
        }
        return res.json(null);
    } catch (e) {
        return res.status(500).json({ error: "Failed to fetch latest access event" });
    }
};

// Check-in (Manual/Kiosk)
const checkIn = async (req, res) => {
    let { memberId, trainerId, qrToken, qrData } = req.body;
    try {
        const inboundQr = qrToken || qrData;
        if (inboundQr) {
            const resolved = resolveIdsFromQrToken(inboundQr);
            memberId = resolved.memberId;
            trainerId = resolved.trainerId;
        } else if (!ACCESS_ALLOW_STATIC_IDS) {
            return res.status(403).json({ error: "Static QR IDs are disabled. Please scan the latest dynamic QR." });
        }

        const hasMemberId = memberId !== undefined && memberId !== null && memberId !== '';
        const hasTrainerId = trainerId !== undefined && trainerId !== null && trainerId !== '';

        if ((hasMemberId && hasTrainerId) || (!hasMemberId && !hasTrainerId)) {
            return res.status(400).json({ error: "Provide exactly one of memberId or trainerId" });
        }

        if (hasMemberId) {
            const parsedMemberId = Number(memberId);
            if (!Number.isInteger(parsedMemberId) || parsedMemberId <= 0) {
                return res.status(400).json({ error: "Valid memberId is required" });
            }

            const { log, error } = await createMemberAccessLog(parsedMemberId, req.user?.gymId || req.gymId);
            if (error) {
                setLatestAccessEvent({ status: 'DENIED', reason: error.payload?.error || error.payload?.reason || 'Access denied' });
                return res.status(error.status).json(error.payload);
            }
            setLatestAccessEvent({ status: log.status, log });
            return res.json(log);
        }

        const parsedTrainerId = Number(trainerId);
        if (!Number.isInteger(parsedTrainerId) || parsedTrainerId <= 0) {
            return res.status(400).json({ error: "Valid trainerId is required" });
        }

        const { log, error } = await createTrainerAccessLog(parsedTrainerId, req.user?.gymId || req.gymId);
        if (error) {
            setLatestAccessEvent({ status: 'DENIED', reason: error.payload?.error || 'Access denied' });
            return res.status(error.status).json(error.payload);
        }
        setLatestAccessEvent({ status: log.status, log });
        return res.json(log);
    } catch (e) {
        if (e?.name === 'TokenExpiredError') {
            const error = "QR token expired. Please refresh QR and try again.";
            setLatestAccessEvent({ status: 'DENIED', reason: error });
            return res.status(403).json({ error });
        }
        if (e?.name === 'JsonWebTokenError' || e?.message === 'INVALID_QR_TOKEN' || e?.message === 'INVALID_QR_ENTITY') {
            const error = "Invalid QR token";
            setLatestAccessEvent({ status: 'DENIED', reason: error });
            return res.status(403).json({ error });
        }
        if (e?.message === 'QR_TOKEN_ALREADY_USED') {
            const error = "QR token was already used. Please use the latest QR code.";
            setLatestAccessEvent({ status: 'DENIED', reason: error });
            return res.status(403).json({ error });
        }
        if (e?.message === 'MISSING_QR_SECRET') {
            const error = "QR token secret is not configured";
            setLatestAccessEvent({ status: 'DENIED', reason: error });
            return res.status(500).json({ error });
        }
        setLatestAccessEvent({ status: 'DENIED', reason: "Check-in failed" });
        res.status(500).json({ error: "Check-in failed" });
    }
};

const getAccessLogs = async (req, res) => {
    try {
        const { date, page, limit } = req.query;
        let where = {};

        if (req.user?.role === 'MEMBER') {
            where.memberId = Number(req.user.id);
        } else if (req.user?.role === 'TRAINER') {
            const trainerId = Number(req.user?.trainerId);
            if (!Number.isInteger(trainerId) || trainerId <= 0) {
                return res.status(400).json({ error: "Trainer account is not linked" });
            }
            where.trainerId = trainerId;
        }

        if (req.user?.role !== 'OWNER') {
            where.tenantId = Number(req.user.tenantId);
            where.gymId = Number(req.gymId || req.user.gymId);
        }

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            where.checkIn = { gte: start, lte: end };
        }

        if (page && limit) {
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;

            const [logs, total] = await Promise.all([
                prisma.accessLog.findMany({
                    where,
                    skip,
                    take: limitNum,
                    include: accessLogInclude,
                    orderBy: { checkIn: 'desc' }
                }),
                prisma.accessLog.count({ where })
            ]);

            return res.json({
                data: logs,
                meta: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            });
        }

        const logs = await prisma.accessLog.findMany({
            where,
            include: accessLogInclude,
            orderBy: { checkIn: 'desc' },
            take: (req.user?.role === 'MEMBER' || req.user?.role === 'TRAINER') ? 1000 : 100
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};

const getTrafficStats = async (req, res) => {
    try {
        const now = new Date();
        const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const requestedStart = req.query?.start ? new Date(req.query.start) : defaultStart;
        const requestedEnd = req.query?.end ? new Date(req.query.end) : now;

        if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime())) {
            return res.status(400).json({ error: "Invalid date range" });
        }

        const where = {
            checkIn: {
                gte: requestedStart,
                lte: requestedEnd
            }
        };

        if (req.user.role !== 'OWNER') {
            where.tenantId = Number(req.user.tenantId);
            where.gymId = Number(req.gymId || req.user.gymId);
        }

        const logs = await prisma.accessLog.findMany({
            where,
            orderBy: { checkIn: 'asc' }
        });

        const hourly = new Array(24).fill(0);
        logs.forEach(log => {
            const hour = new Date(log.checkIn).getHours();
            hourly[hour]++;
        });

        res.json({
            logs,
            range: {
                start: requestedStart.toISOString(),
                end: requestedEnd.toISOString()
            },
            todayTotal: logs.length,
            hourly
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch traffic" });
    }
};

const getAccessLogDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const log = await prisma.accessLog.findUnique({
            where: { id: Number(id) },
            include: accessLogInclude
        });
        if (!log) return res.status(404).json({ error: "Log not found" });
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};


// Simulation Route (Dev/Demo only)
const simulateAccess = async (req, res) => {
    try {
        const { type } = req.body; // 'valid', 'expired', 'denied'
        const tenantId = Number(req.user?.tenantId);
        const gymId = Number(req.gymId || req.user?.gymId);
        const scopedWhere = {
            gym: { tenantId },
            ...(Number.isInteger(gymId) && gymId > 0 ? { gymId } : {})
        };

        // Find a random member fitting the criteria
        let member;
        if (type === 'valid') {
            member = await prisma.member.findFirst({ where: { status: 'ACTIVE', ...scopedWhere } });
        } else if (type === 'expired') {
            member = await prisma.member.findFirst({ where: { status: 'EXPIRED', ...scopedWhere } });
        }

        if (!member) {
            // Fallback to any member
            member = await prisma.member.findFirst({ where: scopedWhere });
        }

        if (!member) return res.status(404).json({ error: "No members found to simulate" });

        const status = (type === 'valid' && member.status === 'ACTIVE') ? 'ALLOWED' : 'DENIED';

        const log = await prisma.accessLog.create({
            data: {
                memberId: member.id,
                status,
                checkIn: new Date(),
                gymId: Number.isInteger(gymId) && gymId > 0 ? gymId : null,
                tenantId: Number.isInteger(tenantId) && tenantId > 0 ? tenantId : 1
            },
            include: accessLogInclude
        });
        setLatestAccessEvent({ status: log.status, log });

        res.json(log);
    } catch (e) {
        res.status(500).json({ error: "Simulation failed" });
    }
};

module.exports = {
    getDynamicQrToken,
    getLatestAccessEvent,
    checkIn,
    getAccessLogs,
    getTrafficStats,
    getAccessLogDetails,
    simulateAccess
};
