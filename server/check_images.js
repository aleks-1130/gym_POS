const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking product images...");
    const products = await prisma.product.findMany({
        orderBy: { name: 'asc' }
    });

    const missing = products.filter(p => !p.imageUrl || p.imageUrl.startsWith('http') || p.imageUrl === '');

    console.log(`Found ${missing.length} products with remote/missing images:`);
    missing.forEach(p => {
        console.log(`- ${p.name} (Current: ${p.imageUrl})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
