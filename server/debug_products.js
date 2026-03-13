const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- DB PRODUCT CHECK ---");
        const count = await prisma.product.count();
        console.log("Total products in DB:", count);

        const sample = await prisma.product.findMany({ take: 5 });
        console.log("Sample products:", JSON.stringify(sample, null, 2));

        console.log("\n--- REDIS HOLD CHECK ---");
        try {
            const { createClient } = require('redis');
            const client = createClient();
            await client.connect();
            const keys = await client.keys('cart:reserve:*');
            console.log("Hold keys found:", keys.length);
            for (const key of keys) {
                const data = await client.hGetAll(key);
                console.log(`Key: ${key} Data:`, data);
            }
            await client.quit();
        } catch (re) {
            console.log("Redis not accessible or not installed:", re.message);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
