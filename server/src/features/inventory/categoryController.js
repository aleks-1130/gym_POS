const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

const DEFAULT_CATEGORY_NAMES = ['SUPPLEMENT', 'DRINK', 'MERCH', 'EQUIPMENT', 'OTHER'];

const normalizeCategoryName = (value) => String(value || '').trim();
const normalizeCategoryDescription = (value) => String(value || '').trim();

const ensureDefaultCategories = async (tenantId) => {
    if (!tenantId) return;
    const count = await prisma.category.count({ where: { tenantId } });
    if (count > 0) return;

    await prisma.category.createMany({
        data: DEFAULT_CATEGORY_NAMES.map((name) => ({
            name,
            description: '',
            tenantId,
            isGlobal: true
        })),
        skipDuplicates: true
    });
};

const buildCategoryResponse = async (categories, tenantId) => {
    const productCounts = await prisma.product.groupBy({
        by: ['category'],
        where: { tenantId },
        _count: { _all: true }
    });

    const countByCategory = new Map(
        productCounts.map((row) => [String(row.category || '').toLowerCase(), row._count._all || 0])
    );

    return categories
        .map((category) => ({
            ...category,
            productCount: countByCategory.get(category.name.toLowerCase()) || 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const getCategories = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        await ensureDefaultCategories(tenantId);
        const categories = await prisma.category.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });
        const response = await buildCategoryResponse(categories, tenantId);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

const createCategory = async (req, res) => {
    const name = normalizeCategoryName(req.body.name);
    const description = normalizeCategoryDescription(req.body.description);

    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    try {
        const tenantId = req.tenantId;
        const existing = await prisma.category.findFirst({
            where: { 
                tenantId,
                name: { equals: name, mode: 'insensitive' } 
            }
        });
        if (existing) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const created = await prisma.category.create({
            data: { 
                name, 
                description: description || null,
                tenantId: req.tenantId,
                isGlobal: req.body.isGlobal === true || String(req.body.isGlobal).toLowerCase() === 'true'
            }
        });

        await logAudit('CREATE_CATEGORY', req.user.email, `Category: ${name}`, 'Created inventory category');
        res.status(201).json({ ...created, description: created.description || '', productCount: 0 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create category' });
    }
};

const updateCategory = async (req, res) => {
    const id = Number(req.params.id);
    const name = normalizeCategoryName(req.body.name);
    const description = normalizeCategoryDescription(req.body.description);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid category id' });
    }
    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    try {
        const tenantId = req.tenantId;
        const existingCategory = await prisma.category.findFirst({ 
            where: { id, tenantId } 
        });
        if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const duplicate = await prisma.category.findFirst({
            where: {
                tenantId,
                id: { not: id },
                name: { equals: name, mode: 'insensitive' }
            }
        });
        if (duplicate) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const previousName = existingCategory.name;
        const updated = await prisma.$transaction(async (tx) => {
            if (previousName.toLowerCase() !== name.toLowerCase()) {
                await tx.product.updateMany({
                    where: { category: previousName, tenantId },
                    data: { category: name }
                });
            }

            return tx.category.update({
                where: { id, tenantId },
                data: {
                    name,
                    description: description || null,
                    isGlobal: req.body.isGlobal === true || String(req.body.isGlobal).toLowerCase() === 'true'
                }
            });
        });

        await logAudit(
            'UPDATE_CATEGORY',
            req.user.email,
            `Category: ${previousName}`,
            `Updated to ${name}`
        );

        const response = await buildCategoryResponse([updated], tenantId);
        const result = response[0] || updated;
        res.json({ ...result, description: result.description || '' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update category' });
    }
};

const deleteCategory = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid category id' });
    }

    try {
        const tenantId = req.tenantId;
        const category = await prisma.category.findFirst({ 
            where: { id, tenantId } 
        });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const linkedProducts = await prisma.product.count({
            where: { category: category.name, tenantId }
        });
        if (linkedProducts > 0) {
            return res.status(400).json({ error: 'Cannot delete category with linked products' });
        }

        await prisma.category.deleteMany({ 
            where: { id, tenantId } 
        });

        await logAudit(
            'DELETE_CATEGORY',
            req.user.email,
            `Category: ${category.name}`,
            'Deleted inventory category'
        );

        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
};

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
