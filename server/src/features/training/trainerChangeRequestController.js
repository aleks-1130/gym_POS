const prisma = require('../../config/prisma');
const { getTrainerAvailability, setTrainerAvailability } = require('../../services/trainerAvailabilityService');
const { logAudit } = require('../../services/auditService');

const ALLOWED_REQUEST_FIELDS = new Set([
    'specialization',
    'specialties',
    'bio',
    'cardImageUrl',
    'imageUrl',
    'statusDescription',
    'sessionPrice'
]);

const normalizeNullableString = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = String(value).trim();
    return normalized ? normalized : null;
};

const normalizeBookingStatus = (value) => {
    if (value === undefined) return undefined;
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'CLOSED' ? 'CLOSED' : 'OPEN';
};

const normalizeSessionPrice = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
    return Math.round(numeric * 100) / 100;
};

const normalizeRequestPayload = (payload) => {
    const raw = payload && typeof payload === 'object' ? payload : {};
    const normalized = {};

    for (const key of Object.keys(raw)) {
        if (!ALLOWED_REQUEST_FIELDS.has(key)) continue;
        if (key === 'sessionPrice') {
            const normalizedSessionPrice = normalizeSessionPrice(raw.sessionPrice);
            if (normalizedSessionPrice !== undefined) normalized.sessionPrice = normalizedSessionPrice;
            continue;
        }
        if (key === 'cardImageUrl' || key === 'imageUrl') {
            const normalizedCardImage = normalizeNullableString(raw[key]);
            if (normalizedCardImage !== undefined) normalized.cardImageUrl = normalizedCardImage;
            continue;
        }
        const value = normalizeNullableString(raw[key]);
        if (value !== undefined) normalized[key] = value;
    }

    return normalized;
};

const toComparable = (value) => (value === undefined ? null : value);

const hasMissingCardImageColumnError = (error) => {
    const message = String(error?.message || '');
    return message.includes('cardImageUrl');
};

const getCurrentSnapshot = async (trainerId) => {
    let trainer = null;
    try {
        trainer = await prisma.trainer.findUnique({
            where: { id: Number(trainerId) },
            select: {
                id: true,
                name: true,
                specialization: true,
                specialties: true,
                bio: true,
                cardImageUrl: true,
                statusDescription: true,
                sessionPrice: true
            }
        });
    } catch (error) {
        if (!hasMissingCardImageColumnError(error)) throw error;

        // Backward compatibility if DB has not yet migrated to cardImageUrl.
        const legacyTrainer = await prisma.trainer.findUnique({
            where: { id: Number(trainerId) },
            select: {
                id: true,
                name: true,
                specialization: true,
                specialties: true,
                bio: true,
                imageUrl: true,
                statusDescription: true,
                sessionPrice: true
            }
        });
        trainer = legacyTrainer
            ? { ...legacyTrainer, cardImageUrl: legacyTrainer.imageUrl || null }
            : null;
    }

    if (!trainer) return null;

    const availability = await getTrainerAvailability(trainer.id);
    return {
        ...trainer,
        bookingStatus: availability?.bookingStatus || 'OPEN'
    };
};

const sanitizeForResponse = (request) => ({
    id: request.id,
    trainerId: request.trainerId,
    requestType: request.requestType,
    payload: request.payload,
    currentData: request.currentData,
    status: request.status,
    adminDecisionAt: request.adminDecisionAt,
    adminNote: request.adminNote,
    ownerDecisionAt: request.ownerDecisionAt,
    ownerNote: request.ownerNote,
    appliedAt: request.appliedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    trainer: request.trainer ? {
        id: request.trainer.id,
        name: request.trainer.name,
        email: request.trainer.email
    } : null,
    requestedBy: request.requestedBy ? {
        id: request.requestedBy.id,
        name: request.requestedBy.name,
        email: request.requestedBy.email
    } : null,
    adminReviewer: request.adminReviewer ? {
        id: request.adminReviewer.id,
        name: request.adminReviewer.name,
        email: request.adminReviewer.email
    } : null,
    ownerReviewer: request.ownerReviewer ? {
        id: request.ownerReviewer.id,
        name: request.ownerReviewer.name,
        email: request.ownerReviewer.email
    } : null
});

const isStrictAdmin = (req) => String(req.user?.role || '').toUpperCase() === 'ADMIN';

const createMyProfileChangeRequest = async (req, res) => {
    try {
        const trainerId = Number(req.user?.trainerId);
        if (!trainerId) {
            return res.status(400).json({ error: 'Trainer account is not linked' });
        }

        const normalizedPayload = normalizeRequestPayload(req.body || {});
        if (Object.keys(normalizedPayload).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const currentSnapshot = await getCurrentSnapshot(trainerId);
        if (!currentSnapshot) {
            return res.status(404).json({ error: 'Trainer not found' });
        }

        const changedPayload = {};
        for (const [key, value] of Object.entries(normalizedPayload)) {
            const current = toComparable(currentSnapshot[key]);
            const next = toComparable(value);
            if (current !== next) changedPayload[key] = value;
        }

        if (Object.keys(changedPayload).length === 0) {
            return res.status(400).json({ error: 'No actual changes detected' });
        }

        const request = await prisma.trainerChangeRequest.create({
            data: {
                trainerId,
                requestedById: Number(req.user.id),
                requestType: 'PROFILE_UPDATE',
                payload: changedPayload,
                currentData: currentSnapshot
            },
            include: {
                trainer: { select: { id: true, name: true, email: true } },
                requestedBy: { select: { id: true, name: true, email: true } }
            }
        });

        await logAudit(
            'TRAINER_PROFILE_CHANGE_REQUESTED',
            req.user.email || `user:${req.user.id}`,
            `trainer:${trainerId}`,
            JSON.stringify({ requestId: request.id, payload: changedPayload }),
            req.user.gymId,
            req.user.tenantId
        );

        return res.status(201).json(sanitizeForResponse(request));
    } catch (e) {
        return res.status(500).json({ error: 'Failed to submit profile change request', detail: e?.message });
    }
};

const getMyProfileChangeRequests = async (req, res) => {
    try {
        const trainerId = Number(req.user?.trainerId);
        if (!trainerId) {
            return res.status(400).json({ error: 'Trainer account is not linked' });
        }

        const requests = await prisma.trainerChangeRequest.findMany({
            where: { 
                trainerId,
                tenantId: Number(req.user.tenantId)
            },
            include: {
                trainer: { select: { id: true, name: true, email: true } },
                requestedBy: { select: { id: true, name: true, email: true } },
                adminReviewer: { select: { id: true, name: true, email: true } },
                ownerReviewer: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(requests.map(sanitizeForResponse));
    } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch change requests', detail: e?.message });
    }
};

const listChangeRequests = async (req, res) => {
    try {
        if (!isStrictAdmin(req)) {
            return res.status(403).json({ error: 'Only admin can review trainer profile change requests' });
        }

        const where = {
            tenantId: Number(req.user.tenantId),
            gymId: Number(req.user.gymId)
        };
        if (statuses.length) {
            where.status = { in: statuses };
        }

        const requests = await prisma.trainerChangeRequest.findMany({
            where,
            include: {
                trainer: { select: { id: true, name: true, email: true } },
                requestedBy: { select: { id: true, name: true, email: true } },
                adminReviewer: { select: { id: true, name: true, email: true } },
                ownerReviewer: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(requests.map(sanitizeForResponse));
    } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch change requests', detail: e?.message });
    }
};

const reviewByAdmin = async (req, res) => {
    try {
        if (!isStrictAdmin(req)) {
            return res.status(403).json({ error: 'Only admin can review trainer profile change requests' });
        }

        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ error: 'Invalid request ID' });

        const action = String(req.body?.action || '').trim().toUpperCase();
        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Use APPROVE or REJECT.' });
        }

        const request = await prisma.trainerChangeRequest.findUnique({
            where: { id: requestId }
        });
        if (!request) return res.status(404).json({ error: 'Change request not found' });
        if (!['PENDING_ADMIN', 'PENDING_OWNER'].includes(String(request.status || '').toUpperCase())) {
            return res.status(400).json({ error: `Request is already ${request.status}` });
        }

        let updated;
        if (action === 'APPROVE') {
            updated = await applyApprovedRequest({
                request,
                adminReviewerId: req.user.id,
                adminNote: normalizeNullableString(req.body?.note) || null
            });
        } else {
            updated = await prisma.trainerChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    adminDecisionBy: Number(req.user.id),
                    adminDecisionAt: new Date(),
                    adminNote: normalizeNullableString(req.body?.note) || null
                },
                include: {
                    trainer: { select: { id: true, name: true, email: true } },
                    requestedBy: { select: { id: true, name: true, email: true } },
                    adminReviewer: { select: { id: true, name: true, email: true } },
                    ownerReviewer: { select: { id: true, name: true, email: true } }
                }
            });
        }

        await logAudit(
            action === 'APPROVE' ? 'TRAINER_PROFILE_CHANGE_APPROVED_BY_ADMIN' : 'TRAINER_PROFILE_CHANGE_REJECTED_BY_ADMIN',
            req.user.email || `user:${req.user.id}`,
            `trainerChangeRequest:${requestId}`,
            JSON.stringify({ action, status: updated.status }),
            req.user.gymId,
            req.user.tenantId
        );

        return res.json(sanitizeForResponse(updated));
    } catch (e) {
        return res.status(500).json({ error: 'Failed to review request', detail: e?.message });
    }
};

const applyApprovedRequest = async ({ request, adminReviewerId, adminNote = null }) => {
    const payload = request?.payload && typeof request.payload === 'object' ? request.payload : {};
    const updateData = {};

    const trainerFields = ['specialization', 'specialties', 'bio', 'cardImageUrl', 'statusDescription'];
    trainerFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
            updateData[field] = normalizeNullableString(payload[field]);
        }
    });
    if (
        !Object.prototype.hasOwnProperty.call(payload, 'cardImageUrl') &&
        Object.prototype.hasOwnProperty.call(payload, 'imageUrl')
    ) {
        updateData.cardImageUrl = normalizeNullableString(payload.imageUrl);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'sessionPrice')) {
        const normalizedSessionPrice = normalizeSessionPrice(payload.sessionPrice);
        if (normalizedSessionPrice !== undefined) {
            updateData.sessionPrice = normalizedSessionPrice;
        }
    }

    if (Object.keys(updateData).length > 0) {
        try {
            await prisma.trainer.update({
                where: { id: Number(request.trainerId) },
                data: updateData
            });
        } catch (error) {
            if (!hasMissingCardImageColumnError(error)) throw error;

            // Backward compatibility if DB has not yet migrated to cardImageUrl.
            const legacyUpdateData = { ...updateData };
            if (Object.prototype.hasOwnProperty.call(legacyUpdateData, 'cardImageUrl')) {
                legacyUpdateData.imageUrl = legacyUpdateData.cardImageUrl;
                delete legacyUpdateData.cardImageUrl;
            }

            if (Object.keys(legacyUpdateData).length > 0) {
                await prisma.trainer.update({
                    where: { id: Number(request.trainerId) },
                    data: legacyUpdateData
                });
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'bookingStatus')) {
        await setTrainerAvailability(Number(request.trainerId), {
            bookingStatus: normalizeBookingStatus(payload.bookingStatus)
        });
    }

    return prisma.trainerChangeRequest.update({
        where: { id: Number(request.id) },
        data: {
            status: 'APPLIED',
            adminDecisionBy: Number(adminReviewerId),
            adminDecisionAt: new Date(),
            adminNote,
            appliedAt: new Date()
        },
        include: {
            trainer: { select: { id: true, name: true, email: true } },
            requestedBy: { select: { id: true, name: true, email: true } },
            adminReviewer: { select: { id: true, name: true, email: true } },
            ownerReviewer: { select: { id: true, name: true, email: true } }
        }
    });
};

module.exports = {
    createMyProfileChangeRequest,
    getMyProfileChangeRequests,
    listChangeRequests,
    reviewByAdmin
};
