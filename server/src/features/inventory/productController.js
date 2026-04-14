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

    const isGlobal = payload.isGlobal === true || String(payload.isGlobal).toLowerCase() === 'true';

    return {
        data: {
            name,
            category,
            description: description || null,
            price,
            imageUrl: payload.imageUrl || null,
            sku: barcode || null,
            isGlobal,
            stock,
            minStock
        },
        stockData: {
            quantity: stock,
            minQuantity: minStock,
            // Supplier and cost are now branch-specific (in ProductStock)
            supplierId: payload.supplierId ? Number(payload.supplierId) : null,
            supplyCost: payload.supplyCost !== undefined && payload.supplyCost !== null && payload.supplyCost !== ''
                ? Number(payload.supplyCost)
                : 0
        }
    };
};

const serializeProduct = (product) => {
    // Priority: Use branch-specific data from stock record if available
    const stockInfo = product.stocks?.[0] || { quantity: 0, minQuantity: 5, supplierId: null, supplyCost: 0 };
    return {
        ...product,
        stock: stockInfo.quantity,
        minStock: stockInfo.minQuantity,
        supplierId: stockInfo.supplierId,
        supplyCost: stockInfo.supplyCost,
        supplier: stockInfo.supplier || null,
        barcode: product.sku || '',
        cost: product.price
    };
};

const getAllProducts = async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const page = Number.parseInt(req.query.page, 10);
        const limit = Number.parseInt(req.query.limit, 10);
        const category = String(req.query.category || '').trim();
        const search = String(req.query.search || '').trim();
        const tenantId = req.tenantId;
        const where = { tenantId };

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
                const allKeys = await redisClient.keys(`cart:reserve:${tenantId}:*`);
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
            serialized.availableStock = (p.stocks?.[0]?.quantity || 0) - (holds[p.id] || 0);
            return serialized;
        };

        if (!isPaginated) {
            console.log("[DEBUG] Fetching products from DB (non-paginated)...");
            const startDb = Date.now();
            const getGymId = () => Number(req.gymId || req.user?.gymId);
            const currentGymId = getGymId();
            const products = await prisma.product.findMany({
                where: {
                    ...where,
                    tenantId: undefined, // Overridden by OR logic below
                    OR: [
                        { isGlobal: true },
                        {
                            AND: [
                                { tenantId: Number(tenantId) },
                                { gymId: Number(currentGymId) }
                            ]
                        }
                    ]
                },
                include: { 
                    stocks: { 
                        where: { gymId: currentGymId },
                        include: { supplier: true }
                    }
                },
                orderBy: { name: 'asc' }
            });
            console.log(`[DEBUG] DB fetch took ${Date.now() - startDb}ms for ${products.length} products`);
            return res.json(products.map(mapWithStock));
        }

        const getGymId = () => Number(req.gymId || req.user?.gymId);
        const currentGymId = getGymId();
        const [total, rows] = await Promise.all([
            prisma.product.count({ 
                where: {
                    ...where,
                    tenantId: undefined,
                    OR: [
                        { isGlobal: true },
                        {
                            AND: [
                                { tenantId: Number(tenantId) },
                                { gymId: Number(currentGymId) }
                            ]
                        }
                    ]
                }
            }),
            prisma.product.findMany({
                where: {
                    ...where,
                    tenantId: undefined,
                    OR: [
                        { isGlobal: true },
                        {
                            AND: [
                                { tenantId: Number(tenantId) },
                                { gymId: Number(currentGymId) }
                            ]
                        }
                    ]
                },
                include: { 
                    stocks: { 
                        where: { gymId: currentGymId },
                        include: { supplier: true }
                    }
                },
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const gymId = req.gymId || req.user?.gymId;
        const tenantId = req.tenantId;

        const product = await prisma.product.findFirst({
            where: { id, tenantId },
            include: { 
                stocks: { 
                    where: { gymId },
                    include: { supplier: true }
                }
            }
        });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(serializeProduct(product));
    } catch (e) {
        console.error("Fetch Product Error:", e);
        try { require('fs').writeFileSync('e:/OJT Files/gym_POS-1/server/error_debug_get.log', e.stack); } catch (err) {}
        res.status(500).json({ error: "Failed to fetch product" });
    }
};

const createProduct = async (req, res) => {
    try {
        const userRole = String(req.user?.role || '').toUpperCase();
        const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(userRole);
        
        const normalized = normalizeProductPayload(req.body);
        if (normalized.error) return res.status(400).json({ error: normalized.error });

        const created = await prisma.$transaction(async (tx) => {
            const gymId = req.gymId || req.user?.gymId;
            const tenantId = req.tenantId;
            if (!gymId) throw new Error("Gym context required to manage stock");

            const productData = { ...normalized.data };
            // Force isGlobal to false for non-admins
            const isGlobal = isAdminOrOwner ? productData.isGlobal : false;
            delete productData.isGlobal;

            const product = await tx.product.create({
                data: {
                    ...productData,
                    isGlobal,
                    tenantId,
                    gym: isGlobal ? { disconnect: true } : { connect: { id: gymId } }
                }
            });

            await tx.productStock.create({
                data: {
                    productId: product.id,
                    gymId,
                    tenantId,
                    ...normalized.stockData
                }
            });

            return tx.product.findFirst({
                where: { id: product.id, tenantId },
                include: { 
                    supplier: true,
                    stocks: { where: { gymId } }
                }
            });
        });

        const gymId = req.gymId || req.user?.gymId;
        const tenantId = req.tenantId;
        await logAudit("CREATE_PRODUCT", req.user.email, `Product: ${created.name}`, "Created new product", gymId, tenantId);
        res.status(201).json(serializeProduct(created));
    } catch (e) {
        console.error("Create Product Error:", e);
        res.status(500).json({ error: e.code === 'P2002' ? "Barcode already exists" : "Failed to create product" });
    }
};

const updateProduct = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const userRole = String(req.user?.role || '').toUpperCase();
        const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(userRole);

        const normalized = normalizeProductPayload(req.body);
        if (normalized.error) return res.status(400).json({ error: normalized.error });

        const updated = await prisma.$transaction(async (tx) => {
            const gymId = req.gymId || req.user?.gymId;
            const tenantId = req.tenantId;
            if (!gymId) throw new Error("Gym context required to manage stock");

            // Verify ownership
            const productWhere = { id, tenantId };
            if (!isAdminOrOwner && req.user.gymId) {
                productWhere.OR = [
                    { isGlobal: true },
                    { gymId: Number(req.user.gymId) }
                ];
            }

            const existing = await tx.product.findFirst({ where: productWhere });
            if (!existing) throw new Error("Product not found or access denied");

            const productData = { ...normalized.data };
            
            // For non-admins, ensure isGlobal doesn't change from existing value
            const isGlobal = isAdminOrOwner ? productData.isGlobal : existing.isGlobal;
            delete productData.isGlobal;

            await tx.product.update({
                where: { id },
                data: {
                    ...productData,
                    isGlobal,
                    gym: isGlobal ? { disconnect: true } : { connect: { id: gymId } }
                }
            });

            await tx.productStock.upsert({
                where: { productId_gymId: { productId: id, gymId } },
                update: { ...normalized.stockData, tenantId },
                create: {
                    productId: id,
                    gymId,
                    tenantId,
                    ...normalized.stockData
                }
            });

            return tx.product.findFirst({
                where: { id, tenantId },
                include: { 
                    stocks: { 
                        where: { gymId },
                        include: { supplier: true }
                    }
                }
            });
        });

        const gymId = req.gymId || req.user?.gymId;
        const tenantId = req.tenantId;
        await logAudit("UPDATE_PRODUCT", req.user.email, `Product: ${updated.name}`, "Updated details", gymId, tenantId);
        res.json(serializeProduct(updated));
    } catch (e) {
        console.error("Update Product Error:", e);
        res.status(500).json({ error: e.code === 'P2002' ? "Barcode already exists" : "Failed to update product" });
    }
};

const deleteProduct = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const tenantId = req.tenantId;
        const productWhere = { id, tenantId };
        if (req.user.role !== 'OWNER' && req.user.gymId) {
            productWhere.OR = [
                { isGlobal: true },
                { gymId: Number(req.user.gymId) }
            ];
        }

        const product = await prisma.product.findFirst({ where: productWhere });
        if (!product) return res.status(404).json({ error: "Product not found" });

        await prisma.product.deleteMany({ 
            where: { id, tenantId } 
        });
        await logAudit("DELETE_PRODUCT", req.user.email, product?.name, `ID: ${id}`, req.user.gymId, req.user.tenantId);
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
        const gymId = req.gymId || req.user?.gymId;
        if (!gymId) return res.status(403).json({ error: "Missing branch context" });

        const tenantId = req.tenantId;
        const product = await prisma.product.findFirst({ 
            where: { id: Number(productId), tenantId },
            include: {
                stocks: { where: { gymId } }
            }
        });
        if (!product) return res.status(404).json({ error: "Product not found" });

        const stockRecord = product.stocks?.[0];
        if (!stockRecord?.supplierId) {
            return res.status(400).json({ error: "Product has no assigned supplier for this branch. Please link a supplier first." });
        }

        const costPerUnit = stockRecord.supplyCost || 0;
        const totalCost = Number(quantity) * costPerUnit;

        const updatedStock = await prisma.$transaction(async (tx) => {
            return tx.productStock.updateMany({
                where: { id: stockRecord.id, tenantId },
                data: { quantity: { increment: Number(quantity) } }
            });
        });

        const expense = await prisma.expense.create({
            data: {
                title: `Restock: ${product.name} (x${quantity})`,
                amount: totalCost,
                category: "INVENTORY",
                date: new Date(),
                notes: notes || `Restocked ${quantity} units @ ${costPerUnit}/unit (Fixed Cost)`,
                recordedBy: req.user.id.toString(),
                supplierId: stockRecord.supplierId,
                gymId: Number(gymId),
                tenantId: Number(tenantId)
            }
        });

        await logAudit(
            "RESTOCK_INVENTORY",
            req.user.email,
            `Product: ${product.name}`,
            `Added ${quantity} units. Fixed Cost: ${totalCost}`,
            gymId,
            tenantId
        );

        res.json({
            message: "Restock successful",
            newStock: updatedStock.quantity,
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
