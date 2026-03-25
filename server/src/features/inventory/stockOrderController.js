const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

const ORDER_STATUSES = {
    PENDING: 'PENDING',
    RECEIVED: 'RECEIVED',
    CANCELLED: 'CANCELLED'
};

const sanitizeItems = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
        return { error: 'At least one order item is required' };
    }

    const normalized = [];
    for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);
        const cost = Number(item.cost);

        if (!Number.isInteger(productId) || productId <= 0) {
            return { error: 'Invalid product item' };
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            return { error: 'Quantity must be a positive integer' };
        }
        if (!Number.isFinite(cost) || cost < 0) {
            return { error: 'Cost must be a non-negative number' };
        }

        normalized.push({
            productId,
            quantity,
            cost
        });
    }

    return { data: normalized };
};

const buildOrderSummary = (items) => {
    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = items.reduce((acc, item) => acc + item.quantity * item.cost, 0);
    return {
        totalQuantity,
        totalLineItems: items.length,
        subtotal
    };
};

const formatOrderNumber = (id, date = new Date()) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `SO-${yyyy}${mm}${dd}-${String(id).padStart(4, '0')}`;
};

const serializeStockOrder = (order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    supplierId: order.supplierId,
    supplierName: order.supplier?.name || '',
    status: order.status,
    notes: order.notes || '',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    createdBy: order.createdBy,
    receivedAt: order.receivedAt,
    cancelledAt: order.cancelledAt,
    items: (order.items || []).map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        barcode: item.barcode || '',
        imageUrl: item.imageUrl || '',
        category: item.category,
        quantity: item.quantity,
        cost: item.cost
    })),
    summary: {
        totalQuantity: order.totalQuantity || 0,
        totalLineItems: order.totalLineItems || 0,
        subtotal: order.subtotal || 0
    }
});

const listStockOrders = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page, 10) || 1;
        const limit = Number.parseInt(req.query.limit, 10) || 10;
        const status = String(req.query.status || '').trim().toUpperCase();

        const where = {
            tenantId: req.user.tenantId,
            gymId: req.user.gymId
        };
        if (status) {
            where.status = status;
        }

        const [total, rows] = await Promise.all([
            prisma.stockOrder.count({ where }),
            prisma.stockOrder.findMany({
                where,
                include: {
                    supplier: { select: { name: true } },
                    items: true
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            })
        ]);

        const totalPages = Math.max(1, Math.ceil(total / limit));
        res.json({
            data: rows.map(serializeStockOrder),
            meta: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stock orders' });
    }
};

const getStockOrderById = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid stock order id' });
    }

    try {
        const order = await prisma.stockOrder.findFirst({
            where: { 
                id,
                tenantId: req.user.tenantId,
                gymId: req.user.gymId
            },
            include: {
                supplier: { select: { name: true } },
                items: true
            }
        });
        if (!order) return res.status(404).json({ error: 'Stock order not found' });
        res.json(serializeStockOrder(order));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stock order' });
    }
};

const createStockOrder = async (req, res) => {
    const supplierId = Number(req.body.supplierId);
    const notes = String(req.body.notes || '').trim();
    const normalizedItems = sanitizeItems(req.body.items);

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
        return res.status(400).json({ error: 'Supplier is required' });
    }
    if (normalizedItems.error) {
        return res.status(400).json({ error: normalizedItems.error });
    }

    try {
        const supplier = await prisma.supplier.findFirst({ 
            where: { 
                id: supplierId,
                tenantId: req.user.tenantId
            } 
        });
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        const productIds = [...new Set(normalizedItems.data.map((item) => item.productId))];
        const products = await prisma.product.findMany({
            where: { 
                id: { in: productIds },
                tenantId: req.user.tenantId
            }
        });
        if (products.length !== productIds.length) {
            return res.status(400).json({ error: 'One or more selected products are invalid' });
        }

        const productById = new Map(products.map((product) => [product.id, product]));
        const items = normalizedItems.data.map((item) => {
            const product = productById.get(item.productId);
            return {
                productId: item.productId,
                name: product.name,
                barcode: product.sku || '',
                imageUrl: product.imageUrl || '',
                category: product.category,
                quantity: item.quantity,
                cost: item.cost
            };
        });
        const summary = buildOrderSummary(items);

        const created = await prisma.$transaction(async (tx) => {
            const order = await tx.stockOrder.create({
                data: {
                    orderNumber: `SO-TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    supplierId: supplier.id,
                    status: ORDER_STATUSES.PENDING,
                    notes: notes || null,
                    createdBy: req.user.id,
                    subtotal: summary.subtotal,
                    totalQuantity: summary.totalQuantity,
                    totalLineItems: summary.totalLineItems,
                    tenantId: req.user.tenantId,
                    gymId: req.user.gymId
                }
            });

            const orderNumber = formatOrderNumber(order.id, new Date(order.createdAt));
            const updatedOrder = await tx.stockOrder.update({
                where: { id: order.id },
                data: { orderNumber }
            });

            await tx.stockOrderItem.createMany({
                data: items.map((item) => ({
                    stockOrderId: order.id,
                    productId: item.productId,
                    name: item.name,
                    barcode: item.barcode,
                    imageUrl: item.imageUrl,
                    category: item.category,
                    quantity: item.quantity,
                    cost: item.cost,
                    tenantId: req.user.tenantId,
                    gymId: req.user.gymId
                }))
            });

            const complete = await tx.stockOrder.findFirst({
                where: { 
                    id: updatedOrder.id,
                    tenantId: req.user.tenantId
                },
                include: {
                    supplier: { select: { name: true } },
                    items: true
                }
            });

            return complete;
        });

        await logAudit(
            'CREATE_STOCK_ORDER',
            req.user.email,
            created.orderNumber,
            `Created stock order with ${summary.totalLineItems} item(s)`,
            req.user.gymId,
            req.user.tenantId
        );

        res.status(201).json(serializeStockOrder(created));
    } catch (error) {
        res.status(500).json({ error: 'Failed to create stock order' });
    }
};

const updateStockOrder = async (req, res) => {
    const id = Number(req.params.id);
    const supplierId = Number(req.body.supplierId);
    const notes = String(req.body.notes || '').trim();
    const normalizedItems = sanitizeItems(req.body.items);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid stock order id' });
    }
    if (!Number.isInteger(supplierId) || supplierId <= 0) {
        return res.status(400).json({ error: 'Supplier is required' });
    }
    if (normalizedItems.error) {
        return res.status(400).json({ error: normalizedItems.error });
    }

    try {
        const existingOrder = await prisma.stockOrder.findFirst({
            where: { 
                id,
                tenantId: req.user.tenantId,
                gymId: req.user.gymId
            },
            include: {
                supplier: { select: { name: true } },
                items: true
            }
        });
        if (!existingOrder) {
            return res.status(404).json({ error: 'Stock order not found' });
        }
        if (existingOrder.status !== ORDER_STATUSES.PENDING) {
            return res.status(400).json({ error: `Only pending orders can be edited (current: ${existingOrder.status})` });
        }

        const supplier = await prisma.supplier.findFirst({ 
            where: { 
                id: supplierId,
                tenantId: req.user.tenantId
            } 
        });
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        const productIds = [...new Set(normalizedItems.data.map((item) => item.productId))];
        const products = await prisma.product.findMany({
            where: { 
                id: { in: productIds },
                tenantId: req.user.tenantId
            }
        });
        if (products.length !== productIds.length) {
            return res.status(400).json({ error: 'One or more selected products are invalid' });
        }

        const productById = new Map(products.map((product) => [product.id, product]));
        const items = normalizedItems.data.map((item) => {
            const product = productById.get(item.productId);
            return {
                productId: item.productId,
                name: product.name,
                barcode: product.sku || '',
                imageUrl: product.imageUrl || '',
                category: product.category,
                quantity: item.quantity,
                cost: item.cost
            };
        });
        const summary = buildOrderSummary(items);

        const updatedOrder = await prisma.$transaction(async (tx) => {
            await tx.stockOrder.update({
                where: { id: existingOrder.id },
                data: {
                    supplierId: supplier.id,
                    notes: notes || null,
                    subtotal: summary.subtotal,
                    totalQuantity: summary.totalQuantity,
                    totalLineItems: summary.totalLineItems
                }
            });

            await tx.stockOrderItem.deleteMany({
                where: { 
                    stockOrderId: existingOrder.id,
                    tenantId: req.user.tenantId
                }
            });

            await tx.stockOrderItem.createMany({
                data: items.map((item) => ({
                    stockOrderId: existingOrder.id,
                    productId: item.productId,
                    name: item.name,
                    barcode: item.barcode,
                    imageUrl: item.imageUrl,
                    category: item.category,
                    quantity: item.quantity,
                    cost: item.cost,
                    tenantId: req.user.tenantId
                }))
            });

            return tx.stockOrder.findFirst({
                where: { 
                    id: existingOrder.id,
                    tenantId: req.user.tenantId
                },
                include: {
                    supplier: { select: { name: true } },
                    items: true
                }
            });
        });

        await logAudit(
            'UPDATE_STOCK_ORDER',
            req.user.email,
            existingOrder.orderNumber,
            `Updated stock order with ${summary.totalLineItems} item(s)`,
            req.user.gymId,
            req.user.tenantId
        );

        res.json(serializeStockOrder(updatedOrder));
    } catch (error) {
        res.status(500).json({ error: 'Failed to update stock order' });
    }
};

const markStockOrderReceived = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid stock order id' });
    }

    try {
        const order = await prisma.stockOrder.findFirst({
            where: { 
                id,
                tenantId: req.user.tenantId,
                gymId: req.user.gymId
            },
            include: {
                supplier: { select: { name: true } },
                items: true
            }
        });
        if (!order) {
            return res.status(404).json({ error: 'Stock order not found' });
        }
        if (order.status !== ORDER_STATUSES.PENDING) {
            return res.status(400).json({ error: `Only pending orders can be received (current: ${order.status})` });
        }

        const updatedOrder = await prisma.$transaction(async (tx) => {
            const gymId = req.gymId || req.user?.gymId;
            if (!gymId) throw new Error("Gym context required to receive stock");

            for (const item of order.items) {
                await tx.productStock.upsert({
                    where: { productId_gymId: { productId: Number(item.productId), gymId } },
                    update: { quantity: { increment: Number(item.quantity) } },
                    create: {
                        productId: Number(item.productId),
                        gymId,
                        quantity: Number(item.quantity),
                        minQuantity: 5, // Default min stock
                        tenantId: req.user.tenantId
                    }
                });
            }

            await tx.expense.create({
                data: {
                    title: `Stock Order ${order.orderNumber}`,
                    amount: Number(order.subtotal || 0),
                    category: 'INVENTORY',
                    date: new Date(),
                    notes: order.notes || `Received stock order ${order.orderNumber}`,
                    recordedBy: req.user.id.toString(),
                    supplierId: order.supplierId,
                    gymId: gymId,
                    tenantId: req.user.tenantId
                }
            });

            return tx.stockOrder.update({
                where: { id: order.id },
                data: {
                    status: ORDER_STATUSES.RECEIVED,
                    receivedAt: new Date()
                },
                include: {
                    supplier: { select: { name: true } },
                    items: true
                }
            });
        });

        await logAudit(
            'RECEIVE_STOCK_ORDER',
            req.user.email,
            order.orderNumber,
            'Marked order as received',
            gymId,
            req.user.tenantId
        );

        res.json(serializeStockOrder(updatedOrder));
    } catch (error) {
        res.status(500).json({ error: 'Failed to receive stock order' });
    }
};

const cancelStockOrder = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid stock order id' });
    }

    try {
        const order = await prisma.stockOrder.findFirst({
            where: { 
                id,
                tenantId: req.user.tenantId,
                gymId: req.user.gymId
            },
            include: {
                supplier: { select: { name: true } },
                items: true
            }
        });
        if (!order) {
            return res.status(404).json({ error: 'Stock order not found' });
        }
        if (order.status !== ORDER_STATUSES.PENDING) {
            return res.status(400).json({ error: `Only pending orders can be cancelled (current: ${order.status})` });
        }

        const updatedOrder = await prisma.stockOrder.update({
            where: { id: order.id },
            data: {
                status: ORDER_STATUSES.CANCELLED,
                cancelledAt: new Date()
            },
            include: {
                supplier: { select: { name: true } },
                items: true
            }
        });

        await logAudit(
            'CANCEL_STOCK_ORDER',
            req.user.email,
            order.orderNumber,
            'Cancelled stock order',
            req.user.gymId,
            req.user.tenantId
        );

        res.json(serializeStockOrder(updatedOrder));
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel stock order' });
    }
};

module.exports = {
    listStockOrders,
    getStockOrderById,
    createStockOrder,
    updateStockOrder,
    markStockOrderReceived,
    cancelStockOrder,
    ORDER_STATUSES
};
