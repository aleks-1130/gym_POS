const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Investigating Expenses Timestamps...");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log("Server 'Today' (Start of Day):", today.toISOString(), "(Local:", today.toString(), ")");

    const expenses = await prisma.expense.findMany();
    console.log(`\nFound ${expenses.length} total expenses.`);

    expenses.forEach(e => {
        console.log(`- Expense: ${e.title} | Amount: ${e.amount} | Date: ${e.date.toISOString()} | Matches 'today'? ${e.date >= today}`);
    });

    const expensesToday = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: { date: { gte: today } }
    });

    console.log(`\nQuery result for 'today' expenses sum: ${expensesToday._sum.amount}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
