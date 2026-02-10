const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log("=== Removing Duplicate Commissions ===");

    // Target Date
    const start = new Date('2026-02-06T00:00:00.000Z');
    const end = new Date('2026-02-06T23:59:59.999Z');

    // Find James Wilson Commissions
    const commissions = await prisma.expense.findMany({
        where: {
            date: { gte: start, lte: end },
            title: "Commission: James Wilson"
        },
        orderBy: { id: 'asc' }
    });

    console.log(`Found ${commissions.length} 'Commission: James Wilson' expenses.`);

    if (commissions.length > 1) {
        // Keep the first one, delete the rest
        const toDelete = commissions.slice(1);
        for (const c of toDelete) {
            await prisma.expense.delete({ where: { id: c.id } });
            console.log(`Deleted duplicate expense ID: ${c.id} (Amt: ${c.amount})`);
        }
    } else {
        console.log("No duplicates found for James Wilson.");
    }

    // Verify Remaining
    const expenses = await prisma.expense.findMany({
        where: { date: { gte: start, lte: end } }
    });

    const totalExp = expenses
        .filter(e =>
            e.title.startsWith('Commission:') ||
            e.title.startsWith('Materials: Session') ||
            e.title.startsWith('Session Material')
        )
        .reduce((sum, e) => sum + e.amount, 0);

    console.log(`\nNew Training Expenses Total: ${totalExp} (Target: 88)`);
}

fix()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
