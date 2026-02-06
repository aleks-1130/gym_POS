
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixNames() {
    console.log("Starting naming fix sequence...");

    // 1. Fetch all Products
    const products = await prisma.product.findMany();
    const productMap = {};
    products.forEach(p => productMap[p.id] = p.name);
    console.log(`Loaded ${products.length} products.`);

    // 2. Fetch PaymentItems that are linked to a product
    const items = await prisma.paymentItem.findMany({
        where: {
            productId: { not: null }
        }
    });

    console.log(`Found ${items.length} payment items with product links.`);
    let updatedCount = 0;

    for (const item of items) {
        const actualName = productMap[item.productId];

        // If we found a matching product name, and the current item name is different
        // specific check: if item.name looks like "Product <ID>" or just doesn't match
        if (actualName && item.name !== actualName) {
            // Optional: stricter check to only fix the broken ones
            // if (item.name.startsWith("Product ")) { ... }
            // But user likely wants them all aligned to current names if they were generic.

            console.log(`[UPDATE] Item ID ${item.id} (Product ${item.productId}): "${item.name}" -> "${actualName}"`);

            await prisma.paymentItem.update({
                where: { id: item.id },
                data: { name: actualName }
            });
            updatedCount++;
        }
    }

    console.log(`\nOperation Complete. Updated ${updatedCount} items.`);
}

fixNames()
    .catch(e => {
        console.error("Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
