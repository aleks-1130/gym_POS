const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function find() {
    console.log("Searching for 60.00 or 55.00...");
    const payments = await prisma.payment.findMany({
        where: {
            OR: [
                { amount: 60 },
                { amount: 55 }
            ]
        }
    });

    payments.forEach(p => {
        console.log(`FOUND: ID:${p.id} Amt:${p.amount} Date:${p.date.toISOString()} Type:${p.type}`);
    });
}

find().finally(() => prisma.$disconnect());
