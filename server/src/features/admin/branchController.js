const prisma = require('../../config/prisma');

// Get all branches for the current tenant
const getBranches = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: "User is not linked to a business/tenant" });
        }

        const branches = await prisma.gym.findMany({
            where: { tenantId },
            include: {
                _count: {
                    select: { members: true, products: true, users: true }
                }
            }
        });

        res.json(branches);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
};

// Create a new branch for the current tenant
const createBranch = async (req, res) => {
    const { name, companyId, currency, taxRate, referencePrefix } = req.body;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
        return res.status(400).json({ error: "User is not linked to a business/tenant" });
    }

    if (!name || !companyId) {
        return res.status(400).json({ error: "Name and Company ID are required" });
    }

    try {
        const newBranch = await prisma.gym.create({
            data: {
                name,
                companyId,
                tenantId,
                currency: currency || 'PHP',
                taxRate: taxRate ? Number(taxRate) : 12.0,
                referencePrefix: referencePrefix || 'A321'
            }
        });

        res.json(newBranch);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: `A branch with Company ID "${companyId}" already exists.` });
        }
        console.error('Error creating branch:', error);
        res.status(500).json({ error: 'Failed to create branch' });
    }
};

// Update an existing branch
const updateBranch = async (req, res) => {
    const { id } = req.params;
    const { name, companyId, currency, taxRate, referencePrefix } = req.body;
    const tenantId = req.user.tenantId;

    try {
        // Ensure the branch belongs to the same tenant
        const branch = await prisma.gym.findFirst({
            where: { id: Number(id), tenantId }
        });

        if (!branch) {
            return res.status(404).json({ error: "Branch not found or unauthorized" });
        }

        const updatedBranch = await prisma.gym.update({
            where: { id: Number(id) },
            data: {
                name: name !== undefined ? name : branch.name,
                companyId: companyId !== undefined ? companyId : branch.companyId,
                currency: currency !== undefined ? currency : branch.currency,
                taxRate: taxRate !== undefined ? Number(taxRate) : branch.taxRate,
                referencePrefix: referencePrefix !== undefined ? referencePrefix : branch.referencePrefix
            }
        });

        res.json(updatedBranch);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: `A branch with Company ID "${companyId}" already exists.` });
        }
        console.error('Error updating branch:', error);
        res.status(500).json({ error: 'Failed to update branch' });
    }
};

module.exports = {
    getBranches,
    createBranch,
    updateBranch
};
