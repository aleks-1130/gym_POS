const fs = require('fs/promises');
const path = require('path');
const prisma = require('../../config/prisma');
const { saveReceiptSettings } = require('../../services/receiptSettingsService');
const { normalizeAvailability } = require('../../services/trainerAvailabilityService');

const CATEGORY_FILE = path.join(__dirname, '../../../data/inventory_categories.json');
const PRODUCT_METADATA_FILE = path.join(__dirname, '../../../data/product_metadata.json');
const RECEIPT_SETTINGS_FILE = path.join(__dirname, '../../../data/receipt_settings.json');
const TRAINER_AVAILABILITY_FILE = path.join(__dirname, '../../../data/trainer_availability.json');
const STOCK_ORDER_FILES = [
    path.join(__dirname, '../../../data/stock_orders.json'),
    path.join(__dirname, '../../../data/stockOrders.json'),
    path.join(__dirname, '../../../data/inventory_stock_orders.json')
];

const ORDER_STATUSES = new Set(['PENDING', 'RECEIVED', 'CANCELLED']);
const DEFAULT_CATEGORY_NAMES = ['SUPPLEMENT', 'DRINK', 'MERCH', 'EQUIPMENT', 'OTHER'];

let hasAttemptedMigration = false;

const hasNonZeroValue = (value) => {
    if (typeof value === 'number') return value > 0;
    if (Array.isArray(value)) return value.some(hasNonZeroValue);
    if (value && typeof value === 'object') return Object.values(value).some(hasNonZeroValue);
    return false;
};

const toCleanString = (value) => String(value ?? '').trim();

const toSafeNumber = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeInt = (value, fallback = null) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
};

const parseDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const readJsonIfExists = async (filePath) => {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        if (!raw || !raw.trim()) return null;
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
};

const readFirstExistingJson = async (filePaths = []) => {
    for (const filePath of filePaths) {
        const parsed = await readJsonIfExists(filePath);
        if (parsed) {
            return parsed;
        }
    }
    return null;
};

const ensureCategoriesSeeded = async () => {
    const currentCount = await prisma.category.count();
    if (currentCount > 0) return { inserted: 0 };

    const created = await prisma.category.createMany({
        data: DEFAULT_CATEGORY_NAMES.map((name) => ({ name, description: '' })),
        skipDuplicates: true
    });
    return { inserted: created.count };
};

const migrateCategoriesFromJson = async () => {
    const data = await readJsonIfExists(CATEGORY_FILE);
    if (!data) return { source: 0, inserted: 0 };

    const sourceCategories = Array.isArray(data?.categories)
        ? data.categories
        : Array.isArray(data)
            ? data
            : [];
    if (sourceCategories.length === 0) return { source: 0, inserted: 0 };

    const deduped = new Map();
    for (const rawCategory of sourceCategories) {
        const name = toCleanString(rawCategory?.name);
        if (!name) continue;
        const key = name.toLowerCase();
        if (!deduped.has(key)) {
            deduped.set(key, {
                name,
                description: toCleanString(rawCategory?.description) || ''
            });
        }
    }

    const payload = [...deduped.values()];
    if (payload.length === 0) return { source: sourceCategories.length, inserted: 0 };

    const created = await prisma.category.createMany({
        data: payload,
        skipDuplicates: true
    });

    return { source: sourceCategories.length, inserted: created.count };
};

const migrateProductDescriptionsFromJson = async () => {
    const data = await readJsonIfExists(PRODUCT_METADATA_FILE);
    const descriptions = data?.descriptions && typeof data.descriptions === 'object'
        ? data.descriptions
        : {};
    const entries = Object.entries(descriptions)
        .map(([key, value]) => ({
            id: toSafeInt(key),
            description: toCleanString(value)
        }))
        .filter((entry) => Number.isInteger(entry.id) && entry.id > 0 && entry.description);

    if (entries.length === 0) {
        return { source: 0, updated: 0, skippedMissingProduct: 0 };
    }

    const existingProducts = await prisma.product.findMany({
        where: { id: { in: entries.map((entry) => entry.id) } },
        select: { id: true, description: true }
    });
    const productById = new Map(existingProducts.map((product) => [product.id, product]));

    let updated = 0;
    let skippedMissingProduct = 0;
    for (const entry of entries) {
        const product = productById.get(entry.id);
        if (!product) {
            skippedMissingProduct += 1;
            continue;
        }
        if (toCleanString(product.description)) {
            continue;
        }
        await prisma.product.update({
            where: { id: entry.id },
            data: { description: entry.description }
        });
        updated += 1;
    }

    return { source: entries.length, updated, skippedMissingProduct };
};

const normalizeOrderStatus = (value) => {
    const normalized = toCleanString(value).toUpperCase();
    return ORDER_STATUSES.has(normalized) ? normalized : 'PENDING';
};

const summarizeItems = (items) => {
    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = items.reduce((acc, item) => acc + item.quantity * item.cost, 0);
    return {
        totalQuantity,
        totalLineItems: items.length,
        subtotal
    };
};

const buildMigratedOrderNumber = (sourceOrder, fallbackIndex) => {
    const explicit = toCleanString(sourceOrder?.orderNumber);
    if (explicit) return explicit;

    const sourceId = toSafeInt(sourceOrder?.id);
    if (sourceId) return `SO-MIG-${sourceId}`;

    return `SO-MIG-${fallbackIndex}`;
};

const migrateStockOrdersFromJson = async () => {
    const data = await readFirstExistingJson(STOCK_ORDER_FILES);
    if (!data) {
        return { source: 0, inserted: 0, skippedInvalid: 0, skippedExisting: 0 };
    }

    const sourceOrders = Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data)
            ? data
            : [];
    if (sourceOrders.length === 0) {
        return { source: 0, inserted: 0, skippedInvalid: 0, skippedExisting: 0 };
    }

    const [suppliers, users, products, existingOrders] = await Promise.all([
        prisma.supplier.findMany({ select: { id: true } }),
        prisma.user.findMany({ select: { id: true } }),
        prisma.product.findMany({
            select: { id: true, name: true, category: true, sku: true, imageUrl: true }
        }),
        prisma.stockOrder.findMany({ select: { orderNumber: true } })
    ]);

    const supplierIds = new Set(suppliers.map((supplier) => supplier.id));
    const userIds = new Set(users.map((user) => user.id));
    const productById = new Map(products.map((product) => [product.id, product]));
    const existingOrderNumbers = new Set(existingOrders.map((order) => order.orderNumber));

    let inserted = 0;
    let skippedInvalid = 0;
    let skippedExisting = 0;

    for (let index = 0; index < sourceOrders.length; index += 1) {
        const sourceOrder = sourceOrders[index];
        const orderNumber = buildMigratedOrderNumber(sourceOrder, index + 1);
        if (!orderNumber) {
            skippedInvalid += 1;
            continue;
        }
        if (existingOrderNumbers.has(orderNumber)) {
            skippedExisting += 1;
            continue;
        }

        const supplierId = toSafeInt(sourceOrder?.supplierId);
        if (!supplierId || !supplierIds.has(supplierId)) {
            skippedInvalid += 1;
            continue;
        }

        const rawItems = Array.isArray(sourceOrder?.items) ? sourceOrder.items : [];
        const normalizedItems = [];
        for (const rawItem of rawItems) {
            const quantity = toSafeInt(rawItem?.quantity, 0);
            const cost = toSafeNumber(rawItem?.cost, 0);
            const productId = toSafeInt(rawItem?.productId);
            const linkedProduct = productId ? productById.get(productId) : null;

            if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(cost) || cost < 0) {
                continue;
            }

            const name = toCleanString(rawItem?.name) || linkedProduct?.name;
            const category = toCleanString(rawItem?.category) || linkedProduct?.category;
            if (!name || !category) {
                continue;
            }

            normalizedItems.push({
                productId: linkedProduct ? linkedProduct.id : null,
                name,
                barcode: toCleanString(rawItem?.barcode) || linkedProduct?.sku || '',
                imageUrl: toCleanString(rawItem?.imageUrl) || linkedProduct?.imageUrl || '',
                category,
                quantity,
                cost
            });
        }

        if (normalizedItems.length === 0) {
            skippedInvalid += 1;
            continue;
        }

        const computedSummary = summarizeItems(normalizedItems);
        const sourceSummary = sourceOrder?.summary || {};
        const subtotal = toSafeNumber(sourceSummary.subtotal, computedSummary.subtotal);
        const totalQuantity = toSafeInt(sourceSummary.totalQuantity, computedSummary.totalQuantity);
        const totalLineItems = toSafeInt(sourceSummary.totalLineItems, computedSummary.totalLineItems);
        const createdAt = parseDate(sourceOrder?.createdAt) || new Date();
        const updatedAt = parseDate(sourceOrder?.updatedAt) || createdAt;
        const receivedAt = parseDate(sourceOrder?.receivedAt);
        const cancelledAt = parseDate(sourceOrder?.cancelledAt);
        const status = normalizeOrderStatus(sourceOrder?.status);

        const createdByCandidate = toSafeInt(sourceOrder?.createdBy);
        const createdBy = createdByCandidate && userIds.has(createdByCandidate) ? createdByCandidate : null;

        await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.stockOrder.create({
                data: {
                    orderNumber,
                    supplierId,
                    status,
                    notes: toCleanString(sourceOrder?.notes) || null,
                    createdBy,
                    subtotal,
                    totalQuantity,
                    totalLineItems,
                    createdAt,
                    updatedAt,
                    receivedAt,
                    cancelledAt
                }
            });

            await tx.stockOrderItem.createMany({
                data: normalizedItems.map((item) => ({
                    stockOrderId: createdOrder.id,
                    productId: item.productId,
                    name: item.name,
                    barcode: item.barcode,
                    imageUrl: item.imageUrl,
                    category: item.category,
                    quantity: item.quantity,
                    cost: item.cost
                }))
            });
        });

        existingOrderNumbers.add(orderNumber);
        inserted += 1;
    }

    return { source: sourceOrders.length, inserted, skippedInvalid, skippedExisting };
};

const migrateReceiptSettingsFromJson = async () => {
    const data = await readJsonIfExists(RECEIPT_SETTINGS_FILE);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { source: 0, inserted: 0, skippedExisting: 0 };
    }

    const existingCount = await prisma.receiptSettings.count();
    if (existingCount > 0) {
        return { source: 1, inserted: 0, skippedExisting: 1 };
    }

    await saveReceiptSettings(null, data, 1);
    return { source: 1, inserted: 1, skippedExisting: 0 };
};

const migrateTrainerAvailabilityFromJson = async () => {
    const data = await readJsonIfExists(TRAINER_AVAILABILITY_FILE);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { source: 0, inserted: 0, skippedExisting: 0, skippedMissingTrainer: 0 };
    }

    const sourceEntries = Object.entries(data);
    if (sourceEntries.length === 0) {
        return { source: 0, inserted: 0, skippedExisting: 0, skippedMissingTrainer: 0 };
    }

    const trainerIds = [...new Set(
        sourceEntries
            .map(([trainerId]) => toSafeInt(trainerId))
            .filter((trainerId) => Number.isInteger(trainerId) && trainerId > 0)
    )];
    if (trainerIds.length === 0) {
        return { source: sourceEntries.length, inserted: 0, skippedExisting: 0, skippedMissingTrainer: sourceEntries.length };
    }

    const [existingTrainers, existingAvailability] = await Promise.all([
        prisma.trainer.findMany({
            where: { id: { in: trainerIds } },
            select: { id: true }
        }),
        prisma.trainerAvailability.findMany({
            where: { trainerId: { in: trainerIds } },
            select: { trainerId: true }
        })
    ]);

    const trainerIdSet = new Set(existingTrainers.map((trainer) => trainer.id));
    const existingAvailabilitySet = new Set(existingAvailability.map((row) => row.trainerId));

    let inserted = 0;
    let skippedExisting = 0;
    let skippedMissingTrainer = 0;

    for (const [trainerIdRaw, availabilityRaw] of sourceEntries) {
        const trainerId = toSafeInt(trainerIdRaw);
        if (!Number.isInteger(trainerId) || trainerId <= 0 || !trainerIdSet.has(trainerId)) {
            skippedMissingTrainer += 1;
            continue;
        }
        if (existingAvailabilitySet.has(trainerId)) {
            skippedExisting += 1;
            continue;
        }

        const normalizedAvailability = normalizeAvailability(availabilityRaw || {});
        await prisma.trainerAvailability.create({
            data: {
                trainerId,
                settings: normalizedAvailability
            }
        });
        inserted += 1;
        existingAvailabilitySet.add(trainerId);
    }

    return {
        source: sourceEntries.length,
        inserted,
        skippedExisting,
        skippedMissingTrainer
    };
};

const migrateInventoryDataToDatabase = async () => {
    if (hasAttemptedMigration) {
        return null;
    }
    hasAttemptedMigration = true;

    const summary = {
        categories: { source: 0, inserted: 0 },
        categoryDefaults: { inserted: 0 },
        productDescriptions: { source: 0, updated: 0, skippedMissingProduct: 0 },
        stockOrders: { source: 0, inserted: 0, skippedInvalid: 0, skippedExisting: 0 },
        receiptSettings: { source: 0, inserted: 0, skippedExisting: 0 },
        trainerAvailability: { source: 0, inserted: 0, skippedExisting: 0, skippedMissingTrainer: 0 }
    };

    try {
        summary.categories = await migrateCategoriesFromJson();
        summary.categoryDefaults = await ensureCategoriesSeeded();
        summary.productDescriptions = await migrateProductDescriptionsFromJson();
        summary.stockOrders = await migrateStockOrdersFromJson();
        summary.receiptSettings = await migrateReceiptSettingsFromJson();
        summary.trainerAvailability = await migrateTrainerAvailabilityFromJson();

        if (hasNonZeroValue(summary)) {
            console.log('[Inventory Migration] Completed:', JSON.stringify(summary));
        }
        return summary;
    } catch (error) {
        console.error('[Inventory Migration] Failed:', error.message || error);
        return summary;
    }
};

module.exports = {
    migrateInventoryDataToDatabase
};
