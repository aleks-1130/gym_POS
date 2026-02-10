const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking for duplicates...");

    // Check Suppliers
    const suppliers = await prisma.supplier.findMany();
    const supplierMap = {};
    let supplierDupes = 0;

    suppliers.forEach(s => {
        if (supplierMap[s.name]) {
            supplierDupes++;
            console.log(`Duplicate Supplier: ${s.name} (IDs: ${supplierMap[s.name]}, ${s.id})`);
        } else {
            supplierMap[s.name] = s.id;
        }
    });
    console.log(`Found ${supplierDupes} duplicate suppliers.`);

    // Check Expenses
    const expenses = await prisma.expense.findMany();
    const expenseMap = {};
    let expenseDupes = 0;

    expenses.forEach(e => {
        // key by title + date + amount to identify dupes
        const key = `${e.title}-${e.amount}-${new Date(e.date).toISOString().split('T')[0]}`;
        if (expenseMap[key]) {
            expenseDupes++;
            console.log(`Duplicate Expense: ${e.title} (IDs: ${expenseMap[key]}, ${e.id})`);
        } else {
            expenseMap[key] = e.id;
        }
    });

    console.log(`Found ${expenseDupes} duplicate expenses.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
