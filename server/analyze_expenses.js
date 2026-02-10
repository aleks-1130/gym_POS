const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("📊 Analyzing Expenses...");

    const expenses = await prisma.expense.findMany({
        orderBy: { amount: 'desc' }
    });

    console.log(`Total Expense Records: ${expenses.length}`);

    let total = 0;
    expenses.forEach(e => {
        total += e.amount;
        console.log(`[${e.date.toISOString().split('T')[0]}] ${e.category.padEnd(12)} ₱${e.amount.toLocaleString().padEnd(10)} - ${e.title}`);
    });

    console.log("------------------------------------------------");
    console.log(`TOTAL SUM IN DB: ₱${total.toLocaleString()}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
