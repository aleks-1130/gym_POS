const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

const DEFAULT_CATEGORY_NAMES = ['SUPPLEMENT', 'DRINK', 'MERCH', 'EQUIPMENT', 'OTHER'];

const normalizeCategoryName = (value) => String(value || '').trim();
const normalizeCategoryDescription = (value) => String(value || '').trim();

const ensureDefaultCategories = async () => {
    const count = await prisma.category.count();
    if (count > 0) return;

    await prisma.category.createMany({
        data: DEFAULT_CATEGORY_NAMES.map((name) => ({
            name,
            description: ''
        })),
        skipDuplicates: true
    });
};

const buildCategoryResponse = async (categories) => {
    const productCounts = await prisma.product.groupBy({
        by: ['category'],
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
        await ensureDefaultCategories();
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });
        const response = await buildCategoryResponse(categories);
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
        const existing = await prisma.category.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        });
        if (existing) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const created = await prisma.category.create({
            data: { 
                name, 
                description: description || null,
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
        const existingCategory = await prisma.category.findUnique({ where: { id } });
        if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const duplicate = await prisma.category.findFirst({
            where: {
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
                    where: { category: previousName },
                    data: { category: name }
                });
            }

            return tx.category.update({
                where: { id },
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

        const response = await buildCategoryResponse([updated]);
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
        const category = await prisma.category.findUnique({ where: { id } });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const linkedProducts = await prisma.product.count({
            where: { category: category.name }
        });
        if (linkedProducts > 0) {
            return res.status(400).json({ error: 'Cannot delete category with linked products' });
        }

        await prisma.category.delete({ where: { id } });

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
