const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const topExpenses = await prisma.expense.findMany({
            orderBy: { amount: 'desc' },
            take: 10,
            // include: { user: true }
        });

        console.log("--- TOP 10 HIGHEST EXPENSES ---");
        topExpenses.forEach(exp => {
            console.log(`ID: ${exp.id} | Amount: ${exp.amount} | Date: ${exp.date} | Desc: ${exp.description} | Category: ${exp.category}`);
        });

        const total = await prisma.expense.aggregate({
            _sum: { amount: true }
        });
        console.log("\nTotal Expenses Sum: ", total._sum.amount);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
