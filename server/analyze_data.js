const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function analyze() {
    const start = new Date('2026-02-06T00:00:00.000Z');
    const end = new Date('2026-02-06T23:59:59.999Z');

    const payments = await prisma.payment.findMany({ where: { date: { gte: start, lte: end } } });
    const expenses = await prisma.expense.findMany({ where: { date: { gte: start, lte: end } } });

    let log = `ANALYSIS REPORT (2026-02-06)\n`;
    log += `Total Payments: ${payments.length}\n`;
    log += `Total Expenses: ${expenses.length}\n\n`;

    log += `=== REVENUE ANALYSIS ===\n`;
    payments.forEach(p => {
        const isTraining = p.type === 'TRAINING';
        const isService = p.type === 'SERVICE';
        const active = isTraining || isService;
        log += `[${active ? 'INC' : 'EXC'}] ID:${p.id} Amt:${p.amount} Type:${p.type} Status:${p.status}\n`;
    });

    log += `\n=== EXPENSE ANALYSIS ===\n`;
    expenses.forEach(e => {
        const isComm = e.title.startsWith('Commission:');
        const isMat = e.title.startsWith('Materials: Session');
        const active = isComm || isMat;
        log += `[${active ? 'INC' : 'EXC'}] ID:${e.id} Amt:${e.amount} Title:"${e.title}" Checks(Comm:${isComm}, Mat:${isMat})\n`;
    });

    const rev = payments.filter(p => p.type === 'TRAINING' || p.type === 'SERVICE').reduce((a, b) => a + b.amount, 0);
    const exp = expenses.filter(e => e.title.startsWith('Commission:') || e.title.startsWith('Materials: Session')).reduce((a, b) => a + b.amount, 0);

    log += `\n=== SUMMARY ===\n`;
    log += `Training Revenue: ${rev}\n`;
    log += `Training Expenses: ${exp}\n`;
    log += `Net: ${rev - exp}\n`;

    fs.writeFileSync('analysis.txt', log);
    console.log("Analysis written to analysis.txt");
}

analyze().finally(() => prisma.$disconnect());
