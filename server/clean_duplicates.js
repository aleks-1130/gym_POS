const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Cleaning up duplicates...");

    // 1. CLEAN SUPPLIERS
    const suppliers = await prisma.supplier.findMany();
    const supplierMap = {};
    let deletedSuppliers = 0;

    for (const s of suppliers) {
        if (supplierMap[s.name]) {
            // Found duplicate
            console.log(`Deleting duplicate Supplier: ${s.name} ${s.id}`);
            // Check if used in expenses first
            await prisma.expense.updateMany({
                where: { supplierId: s.id },
                data: { supplierId: supplierMap[s.name].id }
            });
            await prisma.supplier.delete({ where: { id: s.id } });
            deletedSuppliers++;
        } else {
            // First time seeing this supplier
            supplierMap[s.name] = s;
        }
    }
    console.log(`✅ Deleted ${deletedSuppliers} duplicate suppliers.`);

    // 2. CLEAN EXPENSES
    const expenses = await prisma.expense.findMany();
    const expenseMap = {};
    let deletedExpenses = 0;

    for (const e of expenses) {
        // Simple key: title + amount + date (normalized)
        const key = `${e.title}-${e.amount}-${new Date(e.date).toISOString().split('T')[0]}`;

        if (expenseMap[key]) {
            console.log(`Deleting duplicate Expense: ${e.title} ${e.id}`);
            await prisma.expense.delete({ where: { id: e.id } });
            deletedExpenses++;
        } else {
            expenseMap[key] = e;
        }
    }
    console.log(`✅ Deleted ${deletedExpenses} duplicate expenses.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
