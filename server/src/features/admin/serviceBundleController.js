const prisma = require('../../config/prisma');

// Get all service bundles for the current tenant
const getServiceBundles = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { gymId } = req.query;
        console.log('[getServiceBundles] Input ==>', { tenantId, gymId, userRole: req.user.role });

        if (!tenantId) {
            return res.status(400).json({ error: "User is not linked to a business/tenant" });
        }

        const where = {
            isActive: true,
            deletedAt: null,
            OR: [
                { isGlobal: { equals: true } },
                {
                    AND: [
                        { tenantId: Number(tenantId) },
                        ...(gymId && !isNaN(Number(gymId)) ? [{ gymId: Number(gymId) }] : [])
                    ]
                }
            ]
        };

        const bundles = await prisma.serviceBundle.findMany({
            where,
            include: {
                buckets: {
                    include: { product: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        console.log('[getServiceBundles] Result Count ==>', bundles.length);
        console.log('[getServiceBundles] Sample Bundle IDs ==>', bundles.slice(0, 3).map(b => b.id));

        res.set('Cache-Control', 'no-store');
        res.json(bundles);
    } catch (error) {
        console.error('Error fetching service bundles:', error);
        res.status(500).json({ error: 'Failed to fetch service bundles' });
    }
};

// Create a new service bundle
const createServiceBundle = async (req, res) => {
    const { name, description, price, isGlobal, gymId, buckets } = req.body;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
        return res.status(400).json({ error: "User is not linked to a business/tenant" });
    }

    if (!name || price === undefined || !buckets || !Array.isArray(buckets)) {
        return res.status(400).json({ error: "Name, price, and buckets are required" });
    }

    console.log('[DEBUG] Create Bundle Body:', JSON.stringify(req.body, null, 2));

    try {
        const newBundle = await prisma.serviceBundle.create({
            data: {
                name,
                description,
                price: Number(price),
                isGlobal: Boolean(isGlobal),
                tenant: {
                    connect: { id: Number(req.user.tenantId) }
                },
                buckets: {
                    create: buckets.map(b => ({
                        type: b.type,
                        quantity: Number(b.quantity),
                        referencePrice: Number(b.referencePrice),
                        productId: b.productId ? Number(b.productId) : null,
                        productCategory: b.productCategory || null,
                        tenant: {
                            connect: { id: Number(req.user.tenantId) }
                        }
                    }))
                },
                isActive: true,
                gym: gymId ? {
                    connect: { id: Number(gymId) }
                } : undefined
            },
            include: {
                buckets: true
            }
        });

        res.json(newBundle);
    } catch (error) {
        console.error('Error creating service bundle:', error);
        res.status(500).json({ error: 'Failed to create service bundle', details: error.message });
    }
};

// Update a service bundle
const updateServiceBundle = async (req, res) => {
    const { id } = req.params;
    const { name, description, price, isGlobal, gymId, isActive, buckets } = req.body;
    const tenantId = req.user.tenantId;

    try {
        const bundle = await prisma.serviceBundle.findFirst({
            where: { id: Number(id), tenantId }
        });

        if (!bundle) {
            return res.status(404).json({ error: "Service bundle not found or unauthorized" });
        }

        const updatedBundle = await prisma.serviceBundle.update({
            where: { id: Number(id) },
            data: {
                name: name !== undefined ? name : bundle.name,
                description: description !== undefined ? description : bundle.description,
                price: price !== undefined ? Number(price) : bundle.price,
                isGlobal: isGlobal !== undefined ? Boolean(isGlobal) : bundle.isGlobal,
                isActive: isActive !== undefined ? Boolean(isActive) : bundle.isActive,
                gymId: gymId !== undefined ? (gymId ? Number(gymId) : null) : bundle.gymId,
                buckets: buckets ? {
                    deleteMany: {},
                    create: buckets.map(bucket => ({
                        type: bucket.type,
                        quantity: Number(bucket.quantity),
                        referencePrice: Number(bucket.referencePrice),
                        productId: bucket.productId ? Number(bucket.productId) : null,
                        productCategory: bucket.productCategory || null,
                        tenantId
                    }))
                } : undefined
            },
            include: {
                buckets: true
            }
        });

        res.json(updatedBundle);
    } catch (error) {
        console.error('Error updating service bundle:', error);
        res.status(500).json({ error: 'Failed to update service bundle' });
    }
};

// Toggle active status (Soft Delete)
const deleteServiceBundle = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const bundle = await prisma.serviceBundle.findFirst({
            where: { id: Number(id), tenantId }
        });

        if (!bundle) {
            return res.status(404).json({ error: "Service bundle not found" });
        }

        await prisma.serviceBundle.update({
            where: { id: Number(id) },
            data: { 
                isActive: false,
                deletedAt: new Date()
            }
        });

        res.json({ message: "Service bundle deactivated" });
    } catch (error) {
        console.error('Error deactivating service bundle:', error);
        res.status(500).json({ error: 'Failed to deactivate service bundle' });
    }
};

// --- CLASS SESSION PACKAGE LOGIC (Pure Replenishment) ---

const getClassPackages = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { gymId } = req.query;

        const where = {
            isActive: true,
            deletedAt: null,
            OR: [
                { isGlobal: { equals: true } },
                {
                    AND: [
                        { tenantId: Number(tenantId) },
                        ...(gymId && !isNaN(Number(gymId)) ? [{ gymId: Number(gymId) }] : [])
                    ]
                }
            ]
        };

        const packages = await prisma.classSessionPackage.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.set('Cache-Control', 'no-store');
        res.json(packages);
    } catch (error) {
        console.error('Error fetching class packages:', error);
        res.status(500).json({ error: 'Failed to fetch class packages' });
    }
};

const createClassPackage = async (req, res) => {
    const { name, sessions, price, isGlobal, gymId } = req.body;
    const tenantId = req.user.tenantId;

    if (!name || sessions === undefined || price === undefined) {
        return res.status(400).json({ error: "Name, sessions, and price are required" });
    }

    try {
        const newPackage = await prisma.classSessionPackage.create({
            data: {
                name,
                sessions: Number(sessions),
                price: Number(price),
                isGlobal: Boolean(isGlobal),
                tenantId: Number(tenantId),
                gymId: gymId ? Number(gymId) : null
            }
        });
        res.json(newPackage);
    } catch (error) {
        console.error('Error creating class package:', error);
        res.status(500).json({ error: 'Failed to create class package' });
    }
};

const deleteClassPackage = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
        const pkg = await prisma.classSessionPackage.findFirst({
            where: { id: Number(id), tenantId }
        });

        if (!pkg) return res.status(404).json({ error: "Package not found" });

        await prisma.classSessionPackage.update({
            where: { id: Number(id) },
            data: { 
                isActive: false, 
                deletedAt: new Date() 
            }
        });
        res.json({ message: "Package deleted" });
    } catch (error) {
        console.error('Error deleting class package:', error);
        res.status(500).json({ error: 'Failed to delete package' });
    }
};

const updateClassPackage = async (req, res) => {
    const { id } = req.params;
    const { name, sessions, price, isGlobal, gymId, isActive } = req.body;
    const tenantId = req.user.tenantId;

    try {
        const pkg = await prisma.classSessionPackage.findFirst({
            where: { id: Number(id), tenantId }
        });

        if (!pkg) return res.status(404).json({ error: "Package not found or unauthorized" });

        const updated = await prisma.classSessionPackage.update({
            where: { id: Number(id) },
            data: {
                name: name !== undefined ? name : pkg.name,
                sessions: sessions !== undefined ? Number(sessions) : pkg.sessions,
                price: price !== undefined ? Number(price) : pkg.price,
                isGlobal: isGlobal !== undefined ? Boolean(isGlobal) : pkg.isGlobal,
                isActive: isActive !== undefined ? Boolean(isActive) : pkg.isActive,
                gymId: gymId !== undefined ? (gymId ? Number(gymId) : null) : pkg.gymId
            }
        });
        res.json(updated);
    } catch (error) {
        console.error('Error updating class package:', error);
        res.status(500).json({ error: 'Failed to update package' });
    }
};

module.exports = {
    getServiceBundles,
    createServiceBundle,
    updateServiceBundle,
    deleteServiceBundle,
    getClassPackages,
    createClassPackage,
    deleteClassPackage,
    updateClassPackage
};
