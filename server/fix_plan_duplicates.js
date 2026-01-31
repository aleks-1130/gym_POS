const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🛠 Starting Plan Duplicate Merge & Fix...");

    // 1. Get all plans
    const plans = await prisma.plan.findMany({
        orderBy: { id: 'asc' }
    });

    // 2. Group by Name
    const groups = {};
    plans.forEach(p => {
        if (!groups[p.name]) groups[p.name] = [];
        groups[p.name].push(p);
    });

    let deletedCount = 0;
    let reassignedCount = 0;

    // 3. Process groups with duplicates
    for (const [name, items] of Object.entries(groups)) {
        if (items.length > 1) {
            console.log(`\nFound duplicate Plan: "${name}" (${items.length} copies)`);

            // First one is Master (oldest ID)
            const master = items[0];
            const duplicates = items.slice(1);

            console.log(`-> Master: ID ${master.id}`);

            for (const dup of duplicates) {
                console.log(`  -> Processing Duplicate: ID ${dup.id}`);

                // A. Reassign any Members linked to this duplicate
                try {
                    const updateResult = await prisma.member.updateMany({
                        where: { planId: dup.id },
                        data: { planId: master.id }
                    });

                    if (updateResult.count > 0) {
                        console.log(`     ✅ Reassigned ${updateResult.count} Members to Master ID ${master.id}`);
                        reassignedCount += updateResult.count;
                    }
                } catch (e) {
                    console.error(`     ❌ Failed to reassign Members: ${e.message}`);
                    continue;
                }

                // B. Delete the duplicate plan
                try {
                    await prisma.plan.delete({
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
    console.log(`🎉 Plan Cleanup Complete!`);
    console.log(`- Reassigned Members: ${reassignedCount}`);
    console.log(`- Deleted Duplicates: ${deletedCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
