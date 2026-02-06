const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    const start = new Date('2026-02-06T00:00:00.000Z');
    const end = new Date('2026-02-06T23:59:59.999Z');

    const payments = await prisma.payment.findMany({ where: { date: { gte: start, lte: end } } });
    const expenses = await prisma.expense.findMany({ where: { date: { gte: start, lte: end } } });

    console.log("=== DATA CHECK ===");
    // Filter matching Server logic
    const trainingPayments = payments.filter(p => p.type === 'TRAINING' || p.type === 'SERVICE');
    const trainingExpenses = expenses.filter(e =>
        e.title.startsWith('Commission:') ||
        e.title.startsWith('Materials: Session') ||
        e.title.startsWith('Session Material')
    );

    trainingPayments.forEach(p => console.log(`[REV] ID:${p.id} Amt:${p.amount} Type:${p.type}`));
    trainingExpenses.forEach(e => console.log(`[EXP] ID:${e.id} Amt:${e.amount} Title:"${e.title}"`));

    const rev = trainingPayments.reduce((a, b) => a + b.amount, 0);
    const exp = trainingExpenses.reduce((a, b) => a + b.amount, 0);

    console.log(`\n=== FINAL CALCULATION ===`);
    console.log(`Revenue: ${rev}`);
    console.log(`Expenses: ${exp}`);
    console.log(`Net: ${rev - exp}`);
}

debug().finally(() => prisma.$disconnect());
