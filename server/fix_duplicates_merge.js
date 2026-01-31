const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🛠 Starting Advanced Duplicate Merge & Fix...");

    // 1. Get all products
    const products = await prisma.product.findMany({
        orderBy: { id: 'asc' }
    });

    // 2. Group by Name
    const groups = {};
    products.forEach(p => {
        if (!groups[p.name]) groups[p.name] = [];
        groups[p.name].push(p);
    });

    let deletedCount = 0;
    let reassignedCount = 0;

    // 3. Process groups with duplicates
    for (const [name, items] of Object.entries(groups)) {
        if (items.length > 1) {
            console.log(`\nFound duplicate group: "${name}" (${items.length} copies)`);

            // First one is Master (oldest ID)
            const master = items[0];
            const duplicates = items.slice(1);

            console.log(`-> Master: ID ${master.id}`);

            for (const dup of duplicates) {
                console.log(`  -> Processing Duplicate: ID ${dup.id}`);

                // A. Reassign any OrderItems linked to this duplicate
                try {
                    const updateResult = await prisma.orderItem.updateMany({
                        where: { productId: dup.id },
                        data: { productId: master.id }
                    });

                    if (updateResult.count > 0) {
                        console.log(`     ✅ Reassigned ${updateResult.count} OrderItems to Master ID ${master.id}`);
                        reassignedCount += updateResult.count;
                    }
                } catch (e) {
                    console.error(`     ❌ Failed to reassign OrderItems: ${e.message}`);
                    continue; // meaningful failure, skip delete
                }

                // B. Delete the duplicate product
                try {
                    await prisma.product.delete({
                        where: { id: dup.id }
                    });
                    console.log(`     ✅ Deleted Duplicate ID ${dup.id}`);
                    deletedCount++;
                } catch (e) {
                    console.error(`     ❌ Failed to delete ID ${dup.id}: ${e.message}`);
                }
            }
        }
    }

    console.log("\n--------------------------------------------------");
    console.log(`🎉 Cleanup Complete!`);
    console.log(`- Reassigned OrderItems: ${reassignedCount}`);
    console.log(`- Deleted Duplicates: ${deletedCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
