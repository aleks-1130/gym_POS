const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking for duplicate products...");
    const products = await prisma.product.findMany();
    const nameCounts = {};

    products.forEach(p => {
        nameCounts[p.name] = (nameCounts[p.name] || 0) + 1;
    });

    const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);

    if (duplicates.length > 0) {
        console.log("Found duplicates:");
        duplicates.forEach(([name, count]) => {
            console.log(`- ${name}: ${count} copies`);
        });
    } else {
        console.log("No duplicates found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
