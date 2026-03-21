const prisma = require('../../config/prisma');

const normalizePlanInput = (body = {}) => {
    const name = String(body.name || '').trim();
    const price = Number(body.price);
    const duration = Number(body.duration);
    const includesClasses = body.includesClasses === true || String(body.includesClasses).toLowerCase() === 'true';
    const includedClassSessions = includesClasses ? Number(body.includedClassSessions || 0) : 0;
    const freezeLimitCount = Number(body.freezeLimitCount ?? 0);

    if (!name) {
        return { error: "Plan name is required" };
    }
    if (!Number.isFinite(price) || price <= 0) {
        return { error: "Plan price must be greater than 0" };
    }
    if (!Number.isInteger(duration) || duration <= 0) {
        return { error: "Plan duration must be a whole number of days" };
    }
    if (!Number.isInteger(includedClassSessions) || includedClassSessions < 0) {
        return { error: "Included class sessions must be 0 or greater" };
    }
    if (!Number.isInteger(freezeLimitCount) || freezeLimitCount < 0) {
        return { error: "Freeze limit count must be 0 or greater" };
    }

    return {
        data: {
            name,
            price,
            duration,
            includesClasses,
            includedClassSessions,
            freezeLimitCount,
            isGlobal: (body.isGlobal === true || String(body.isGlobal).toLowerCase() === 'true')
        }
    };
};

const getPlans = async (_req, res) => {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { price: 'asc' }
        });
        res.json(plans);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch plans" });
    }
};

const createPlan = async (req, res) => {
    const parsed = normalizePlanInput(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }

    try {
        const plan = await prisma.plan.create({ data: parsed.data });
        res.status(201).json(plan);
    } catch (e) {
        res.status(500).json({ error: "Failed to create plan" });
    }
};

const updatePlan = async (req, res) => {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId)) {
        return res.status(400).json({ error: "Invalid plan ID" });
    }

    const parsed = normalizePlanInput(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }

    try {
        const updated = await prisma.plan.update({
            where: { id: planId },
            data: parsed.data
        });
        res.json(updated);
    } catch (e) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: "Plan not found" });
        }
        res.status(500).json({ error: "Failed to update plan" });
    }
};

const deletePlan = async (req, res) => {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId)) {
        return res.status(400).json({ error: "Invalid plan ID" });
    }

    try {
        const memberCount = await prisma.member.count({
            where: { planId, status: { not: 'DELETED' } }
        });
        if (memberCount > 0) {
            return res.status(400).json({
                error: "Cannot delete plan with active members assigned"
            });
        }

        await prisma.plan.delete({ where: { id: planId } });
        res.json({ success: true });
    } catch (e) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: "Plan not found" });
        }
        res.status(500).json({ error: "Failed to delete plan" });
    }
};

const normalizePackageInput = (body = {}) => {
    const name = String(body.name || '').trim();
    const sessions = Number(body.sessions);
    const price = Number(body.price);
    const isActive = body.isActive === undefined
        ? true
        : (body.isActive === true || String(body.isActive).toLowerCase() === 'true');

    if (!name) {
        return { error: "Package name is required" };
    }
    if (!Number.isInteger(sessions) || sessions <= 0) {
        return { error: "Sessions must be a whole number greater than 0" };
    }
    if (!Number.isFinite(price) || price <= 0) {
        return { error: "Price must be greater than 0" };
    }

    return {
        data: { 
            name, 
            sessions, 
            price, 
            isActive,
            isGlobal: (body.isGlobal === true || String(body.isGlobal).toLowerCase() === 'true')
        }
    };
};

const getClassSessionPackages = async (_req, res) => {
    try {
        const packages = await prisma.classSessionPackage.findMany({
            orderBy: [{ isActive: 'desc' }, { sessions: 'asc' }]
        });
        res.json(packages);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch class session packages" });
    }
};

const createClassSessionPackage = async (req, res) => {
    const parsed = normalizePackageInput(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }
    try {
        const created = await prisma.classSessionPackage.create({ data: parsed.data });
        res.status(201).json(created);
    } catch (e) {
        res.status(500).json({ error: "Failed to create class session package" });
    }
};

const updateClassSessionPackage = async (req, res) => {
    const packageId = Number(req.params.id);
    if (!Number.isInteger(packageId)) {
        return res.status(400).json({ error: "Invalid package ID" });
    }
    const parsed = normalizePackageInput(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }
    try {
        const updated = await prisma.classSessionPackage.update({
            where: { id: packageId },
            data: parsed.data
        });
        res.json(updated);
    } catch (e) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: "Package not found" });
        }
        res.status(500).json({ error: "Failed to update class session package" });
    }
};

const deleteClassSessionPackage = async (req, res) => {
    const packageId = Number(req.params.id);
    if (!Number.isInteger(packageId)) {
        return res.status(400).json({ error: "Invalid package ID" });
    }
    try {
        await prisma.classSessionPackage.delete({ where: { id: packageId } });
        res.json({ success: true });
    } catch (e) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: "Package not found" });
        }
        res.status(500).json({ error: "Failed to delete class session package" });
    }
};

module.exports = {
    getPlans,
    createPlan,
    updatePlan,
    deletePlan,
    getClassSessionPackages,
    createClassSessionPackage,
    updateClassSessionPackage,
    deleteClassSessionPackage
};
