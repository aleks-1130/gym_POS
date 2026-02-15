const prisma = require('../config/prisma');

const getAllSessions = async (req, res) => {
    try {
        const sessions = await prisma.trainingSession.findMany({
            orderBy: { date: 'desc' },
            take: 200,
            select: {
                id: true,
                memberId: true,
                trainerId: true,
                date: true,
                duration: true,
                price: true,
                status: true,
                commissionPaid: true,
                materialsCost: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                member: true,
                trainer: { include: { classes: true } }
            }
        });
        res.json(sessions);
    } catch (e) {
        console.error("Fetch Sessions Error:", e);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
};

const getSessionById = async (req, res) => {
    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: Number(req.params.id) },
            select: {
                id: true,
                date: true,
                duration: true,
                price: true,
                status: true,
                commissionPaid: true,
                materialsCost: true,
                notes: true,
                createdAt: true,
                member: true,
                trainer: true,
                materials: true
            }
        });
        if (!session) return res.status(404).json({ error: "Session not found" });

        // Authorization check if Trainer
        if (req.user.role === 'TRAINER') {
            if (session.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }

        res.json(session);
    } catch (e) {
        console.error("Fetch Session Details Error:", e);
        res.status(500).json({ error: "Failed to fetch session details" });
    }
};

const completeSession = async (req, res) => {
    const { id } = req.params;
    const { materialsCost, notes, materials } = req.body;
    console.log(`[DEBUG] Completing Session ${id}`, { materialsCost, notes, materials });

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: Number(id) },
            include: { trainer: true }
        });
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // Authorization check if Trainer
        if (req.user.role === 'TRAINER') {
            if (session.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }

        // Calculate total material cost if not provided manually
        let calculatedMatCost = parseFloat(materialsCost) || 0;

        // Process Materials (Inventory & Expense)
        if (materials && Array.isArray(materials) && materials.length > 0) {
            calculatedMatCost = 0; // Recalculate based on items

            for (const item of materials) {
                const itemCost = (parseFloat(item.cost) || 0) * (Number(item.quantity) || 1);
                calculatedMatCost += itemCost;

                // 1. Record Session Material Link
                await prisma.sessionMaterial.create({
                    data: {
                        sessionId: session.id,
                        productId: item.productId ? Number(item.productId) : null,
                        name: item.name,
                        category: item.category || 'OTHER',
                        quantity: Number(item.quantity) || 1,
                        costPerUnit: parseFloat(item.cost) || 0,
                        totalCost: itemCost
                    }
                });

                // 2. Decrement Stock if Product ID exists
                if (item.productId) {
                    await prisma.product.update({
                        where: { id: Number(item.productId) },
                        data: { stock: { decrement: Number(item.quantity) || 1 } }
                    });
                }

                // 3. Create Expense Record
                await prisma.expense.create({
                    data: {
                        title: `Session Material: ${item.name}`,
                        amount: itemCost,
                        category: 'SESSION_MATERIAL',
                        date: new Date(),
                        notes: `Used in session #${session.id} with ${session.trainer.name}`,
                        recordedBy: req.user.id.toString()
                    }
                });
            }
        } else if (calculatedMatCost > 0) {
            // Logic for manual cost entry without specific items
            await prisma.expense.create({
                data: {
                    title: `Session Material (Manual)`,
                    amount: calculatedMatCost,
                    category: 'SESSION_MATERIAL',
                    date: new Date(),
                    notes: `Used in session #${session.id} (Manual Entry)`,
                    recordedBy: req.user.id.toString()
                }
            });
        }

        // 4. Process Commission
        const commissionAmount = session.price * (session.trainer?.commissionRate || 0);
        if (commissionAmount > 0) {
            await prisma.expense.create({
                data: {
                    title: `Commission: ${session.trainer.name}`,
                    amount: commissionAmount,
                    category: 'SALARY',
                    date: new Date(),
                    notes: `Session #${session.id} - ${(session.trainer.commissionRate * 100).toFixed(0)}% of ${session.price}`,
                    recordedBy: req.user.id.toString()
                }
            });
        }

        const updated = await prisma.trainingSession.update({
            where: { id: Number(id) },
            data: {
                status: 'COMPLETED',
                materialsCost: calculatedMatCost,
                notes: notes,
                commissionPaid: commissionAmount > 0
            }
        });

        res.json(updated);
    } catch (e) {
        console.error("Complete Session Error:", e);
        res.status(500).json({ error: "Failed to complete session" });
    }
};

const updateSession = async (req, res) => {
    try {
        // Limited update (Date/Time/Duration/Notes)
        const sessionId = Number(req.params.id);
        const { date, time, duration, notes } = req.body;

        const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
        if (!session) return res.status(404).json({ error: "Session not found" });

        // Authorization check if Trainer
        if (req.user.role === 'TRAINER') {
            if (session.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }

        let nextDateTime = session.date;
        if (date || time) {
            const current = new Date(session.date);
            const yyyyMmDd = date || current.toISOString().split('T')[0];
            const hhmm = time || `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
            const composed = new Date(`${yyyyMmDd}T${hhmm}`);
            if (isNaN(composed.getTime())) {
                return res.status(400).json({ error: "Invalid date or time" });
            }
            nextDateTime = composed;
        }

        let nextDuration = session.duration;
        if (duration !== undefined && duration !== null && duration !== '') {
            const numeric = Number(duration);
            if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 480) {
                return res.status(400).json({ error: "Invalid duration" });
            }
            nextDuration = Math.round(numeric);
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                date: nextDateTime,
                duration: nextDuration,
                notes: notes !== undefined ? (notes || null) : session.notes
            }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update session", detail: e?.message });
    }
};

// Admin view of a trainer's sessions
const getTrainerSessions = async (req, res) => {
    try {
        const sessions = await prisma.trainingSession.findMany({
            where: { trainerId: Number(req.params.id) },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                memberId: true,
                trainerId: true,
                date: true,
                duration: true,
                price: true,
                status: true,
                commissionPaid: true,
                materialsCost: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                member: true
            }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions" });
    }
};

// Trainer's own sessions
const getMySessions = async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const sessions = await prisma.trainingSession.findMany({
            where: { trainerId: Number(trainerId) },
            include: { member: true },
            orderBy: { date: 'asc' }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions" });
    }
};

const declineSession = async (req, res) => {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: "Invalid session ID" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) return res.status(404).json({ error: "Training session not found" });

        if (req.user.role === 'TRAINER' && Number(req.user.trainerId) !== Number(session.trainerId)) {
            return res.status(403).json({ error: "Access denied" });
        }

        if (session.paymentStatus === 'PAID') {
            return res.status(400).json({ error: "Cannot decline a paid booking" });
        }

        if (session.status === 'CANCELLED') {
            return res.json({ ...session, message: "Booking already cancelled" });
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                status: 'CANCELLED',
                paymentStatus: 'UNPAID',
                notes: [session.notes, `Declined by ${req.user.role} ${req.user.id} on ${new Date().toISOString()}`]
                    .filter(Boolean)
                    .join('\n')
            }
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to decline booking", detail: e?.message });
    }
};

module.exports = {
    getAllSessions,
    getSessionById,
    completeSession,
    updateSession,
    getTrainerSessions,
    getMySessions,
    declineSession
};
