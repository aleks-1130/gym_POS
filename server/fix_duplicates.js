const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🛠 Fixing duplicate products...");
    const products = await prisma.product.findMany({
        orderBy: { id: 'asc' } // Keep the oldest/first one
    });

    const seenNames = new Set();
    const toDelete = [];

    for (const p of products) {
        if (seenNames.has(p.name)) {
            toDelete.push(p.id);
        } else {
            seenNames.add(p.name);
        }
    }

    console.log(`Found ${toDelete.length} duplicate products to remove.`);

    for (const id of toDelete) {
        try {
            await prisma.product.delete({
                where: { id: id }
            });
            console.log(`✅ Deleted Product ID: ${id}`);
        } catch (e) {
            console.error(`❌ Failed to delete Product ID: ${id}. It might be used in Orders. Error: ${e.message.split('\n')[0]}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
