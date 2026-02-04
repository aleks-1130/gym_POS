const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const topPayments = await prisma.payment.findMany({
            orderBy: { amount: 'desc' },
            take: 10
        });

        console.log("--- TOP 10 PAYMENTS ---");
        topPayments.forEach(p => {
            console.log(`ID: ${p.id} | Amount: ${p.amount} | Date: ${p.date}`);
        });

        const total = await prisma.payment.aggregate({
            _sum: { amount: true }
        });
        console.log("\nTotal Payments Sum: ", total._sum.amount);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
