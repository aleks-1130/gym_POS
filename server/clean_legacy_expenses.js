const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Cleaning up LEGACY expenses (Pre-2025)...");

    // Count before
    const beforeCount = await prisma.expense.count();
    console.log(`Total Expenses Before: ${beforeCount}`);

    // Find and Delete
    const deleted = await prisma.expense.deleteMany({
        where: {
            date: {
                lt: new Date('2025-01-01')
            }
        }
    });

    console.log(`✅ Deleted ${deleted.count} legacy expenses.`);

    // Count after
    const afterCount = await prisma.expense.count();
    console.log(`Total Expenses After: ${afterCount}`);

    // List remaining
    const remaining = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
    console.log("\nRemaining Expenses:");
    remaining.forEach(e => {
        console.log(`[${e.date.toISOString().split('T')[0]}] ₱${e.amount} - ${e.title}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
