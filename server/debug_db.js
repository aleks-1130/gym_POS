const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function main() {
    console.log("Starting DB Connection Test...");
    console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Defined" : "UNDEFINED");
    
    try {
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log("Connection Successful:", result);
    } catch (e) {
        console.error("Connection Failed!");
        console.error("Error Name:", e.name);
        console.error("Error Message:", e.message);
        console.error("Full Error:", JSON.stringify(e, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

main();
