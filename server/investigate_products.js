const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const products = await prisma.product.findMany({
            take: 10
        });

        console.log("--- TOP 10 PRODUCTS ---");
        products.forEach(p => {
            console.log(`Name: ${p.name} | Price: ${p.price} | SupplyCost: ${p.supplyCost}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
