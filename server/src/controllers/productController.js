const prisma = require('../config/prisma');
const logAudit = require('../services/auditService');

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
    const { name, category, price, stock, minStock, imageUrl, supplyCost, supplierId } = req.body;
    try {
        const product = await prisma.product.create({
            data: {
                name, category,
                price: parseFloat(price) || 0,
                stock: Number(stock) || 0,
                minStock: Number(minStock) || 0,
                imageUrl,
                supplyCost: parseFloat(supplyCost) || 0,
                supplierId: supplierId ? Number(supplierId) : null
            }
        });
        await logAudit("CREATE_PRODUCT", req.user.id.toString(), `Product: ${product.name}`, "Created new product");
        res.json(product);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, category, price, stock, minStock, imageUrl, supplyCost, supplierId } = req.body;
    try {
        const product = await prisma.product.update({
            where: { id: Number(id) },
            data: {
                name, category,
                price: parseFloat(price) || 0,
                stock: Number(stock) || 0,
                minStock: Number(minStock) || 0,
                imageUrl,
                supplyCost: parseFloat(supplyCost) || 0,
                supplierId: supplierId ? Number(supplierId) : null
            }
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
