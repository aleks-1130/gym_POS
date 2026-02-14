const prisma = require('../config/prisma');
const logAudit = require('../services/auditService');

const normalizeProductPayload = (payload = {}) => {
    const name = String(payload.name || '').trim();
    const category = String(payload.category || '').trim();
    const price = Number(payload.price);
    const stock = Number(payload.stock);
    const minStock = Number(payload.minStock);
    const supplyCost = payload.supplyCost === undefined || payload.supplyCost === null || payload.supplyCost === ''
        ? 0
        : Number(payload.supplyCost);

    if (!name) return { error: "Product name is required" };
    if (!category) return { error: "Product category is required" };
    if (!Number.isFinite(price) || price < 0) return { error: "Price must be a non-negative number" };
    if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a non-negative integer" };
    if (!Number.isInteger(minStock) || minStock < 0) return { error: "Min stock must be a non-negative integer" };
    if (!Number.isFinite(supplyCost) || supplyCost < 0) return { error: "Supply cost must be a non-negative number" };

    return {
        data: {
            name,
            category,
            price,
            stock,
            minStock,
            imageUrl: payload.imageUrl || null,
            supplyCost,
            supplierId: payload.supplierId ? Number(payload.supplierId) : null
        }
    };
};

const getAllProducts = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(products);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch products" });
    }
};

const createProduct = async (req, res) => {
    try {
        const normalized = normalizeProductPayload(req.body);
        if (normalized.error) return res.status(400).json({ error: normalized.error });

        const product = await prisma.product.create({
            data: normalized.data
        });
        await logAudit("CREATE_PRODUCT", req.user.id.toString(), `Product: ${product.name}`, "Created new product");
        res.json(product);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updateProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const normalized = normalizeProductPayload(req.body);
        if (normalized.error) return res.status(400).json({ error: normalized.error });

        const product = await prisma.product.update({
            where: { id: Number(id) },
            data: normalized.data
        });
        await logAudit("UPDATE_PRODUCT", req.user.id.toString(), `Product: ${product.name}`, "Updated details");
        res.json(product);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const product = await prisma.product.findUnique({ where: { id: Number(id) } });
        await prisma.product.delete({ where: { id: Number(id) } });
        await logAudit("DELETE_PRODUCT", req.user.id.toString(), product?.name, `ID: ${id}`);
        res.json({ message: "Product deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete product" });
    }
};

const restockProduct = async (req, res) => {
    const { productId, quantity, notes } = req.body;

    if (!productId || !quantity) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive integer" });
    }

    try {
        const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
        if (!product) return res.status(404).json({ error: "Product not found" });

        if (!product.supplierId) {
            return res.status(400).json({ error: "Product has no assigned supplier. Please link a supplier first." });
        }

        const costPerUnit = product.supplyCost || 0;
        const totalCost = Number(quantity) * costPerUnit;

        const updatedProduct = await prisma.product.update({
            where: { id: Number(productId) },
            data: { stock: { increment: Number(quantity) } }
        });

        const expense = await prisma.expense.create({
            data: {
                title: `Restock: ${product.name} (x${quantity})`,
                amount: totalCost,
                category: "INVENTORY",
                date: new Date(),
                notes: notes || `Restocked ${quantity} units @ ${costPerUnit}/unit (Fixed Cost)`,
                recordedBy: req.user.id.toString(),
                supplierId: product.supplierId
            }
        });

        await logAudit(
            "RESTOCK_INVENTORY",
            req.user.id.toString(),
            `Product: ${product.name}`,
            `Added ${quantity} units. Fixed Cost: ${totalCost}`
        );

        res.json({
            message: "Restock successful",
            newStock: updatedProduct.stock,
            expenseId: expense.id
        });

    } catch (e) {
        console.error("Restock Error:", e);
        res.status(500).json({ error: "Restock failed" });
    }
};

module.exports = {
    getAllProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    restockProduct
};
