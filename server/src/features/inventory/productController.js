const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');
const { redisClient } = require('../../config/redisClient');

const normalizeProductPayload = (payload = {}) => {
    const name = String(payload.name || '').trim();
    const category = String(payload.category || '').trim();
    const price = payload.price !== undefined && payload.price !== null && payload.price !== ''
        ? Number(payload.price)
        : Number(payload.cost);
    const stock = Number(payload.stock);
    const minStock = Number(payload.minStock);
    const barcode = String(payload.barcode || payload.sku || '').trim();
    const description = String(payload.description || '').trim();
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
            description: description || null,
            price,
            stock,
            minStock,
            imageUrl: payload.imageUrl || null,
            sku: barcode || null,
            supplyCost,
            supplierId: payload.supplierId ? Number(payload.supplierId) : null
        }
    };
};

const serializeProduct = (product) => ({
    ...product,
    barcode: product.sku || '',
    cost: product.price
});

const getAllProducts = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page, 10);
        const limit = Number.parseInt(req.query.limit, 10);
        const category = String(req.query.category || '').trim();
        const search = String(req.query.search || '').trim();
        const where = {};

        if (category && category !== 'All') {
            where.category = category;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } }
            ];
        }

        const isPaginated = Number.isInteger(page) && page > 0 && Number.isInteger(limit) && limit > 0;

        // Fetch global active reservations across all carts from Redis (if available)
        const holds = {};
        const startRedis = Date.now();
        if (redisClient.isOpen && redisClient.isReady) {
            console.log("[DEBUG] Fetching Redis holds...");
            try {
                const allKeys = await redisClient.keys('cart:reserve:*');
                console.log(`[DEBUG] Found ${allKeys.length} hold keys`);
                for (const key of allKeys) {
                    const hdata = await redisClient.hGetAll(key);
                    for (const [pid, qty] of Object.entries(hdata)) {
                        holds[pid] = (holds[pid] || 0) + Number(qty);
                    }
                }
                console.log(`[DEBUG] Redis hold fetch took ${Date.now() - startRedis}ms`);
            } catch (err) {
                console.error("[DEBUG] Product fetch: Redis error ignored:", err.message);
            }
        } else {
            console.log(`[DEBUG] Redis not ready (isOpen: ${redisClient.isOpen}, isReady: ${redisClient.isReady}), skipping holds.`);
        }

        const mapWithStock = (p) => {
            const serialized = serializeProduct(p);
            serialized.availableStock = p.stock - (holds[p.id] || 0);
            return serialized;
        };

        if (!isPaginated) {
            console.log("[DEBUG] Fetching products from DB (non-paginated)...");
            const startDb = Date.now();
            const products = await prisma.product.findMany({
                where,
                orderBy: { name: 'asc' }
            });
            console.log(`[DEBUG] DB fetch took ${Date.now() - startDb}ms for ${products.length} products`);
            return res.json(products.map(mapWithStock));
        }

        const [total, rows] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit
            })
        ]);
        const totalPages = Math.max(1, Math.ceil(total / limit));

        res.json({
            data: rows.map(mapWithStock),
            meta: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch products" });
    }
};

const getProductById = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const product = await prisma.product.findUnique({
            where: { id }
        });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(serializeProduct(product));
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch product" });
    }
};

const createProduct = async (req, res) => {
    try {
        const normalized = normalizeProductPayload(req.body);
        if (normalized.error) return res.status(400).json({ error: normalized.error });

        const existingSku = normalized.data.sku
            ? await prisma.product.findUnique({ where: { sku: normalized.data.sku } })
            : null;
        if (existingSku) {
            return res.status(400).json({ error: "Barcode already exists" });
        }

        const product = await prisma.product.create({
            data: normalized.data
        });
        await logAudit("CREATE_PRODUCT", req.user.email, `Product: ${product.name}`, "Created new product");

        res.json(serializeProduct(product));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const updateProduct = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const normalized = normalizeProductPayload(req.body);
        if (normalized.error) return res.status(400).json({ error: normalized.error });

        if (normalized.data.sku) {
            const existingSku = await prisma.product.findUnique({ where: { sku: normalized.data.sku } });
            if (existingSku && existingSku.id !== id) {
                return res.status(400).json({ error: "Barcode already exists" });
            }
        }

        const product = await prisma.product.update({
            where: { id },
            data: normalized.data
        });
        await logAudit("UPDATE_PRODUCT", req.user.email, `Product: ${product.name}`, "Updated details");
        res.json(serializeProduct(product));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const deleteProduct = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const product = await prisma.product.findUnique({ where: { id } });
        await prisma.product.delete({ where: { id } });
        await logAudit("DELETE_PRODUCT", req.user.email, product?.name, `ID: ${id}`);
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
            req.user.email,
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
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    restockProduct
};
