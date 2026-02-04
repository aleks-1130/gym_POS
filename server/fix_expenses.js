const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Starting Expense Normalization...");

        // Strategy: Look for expenses that appear to be in PHP (large values) vs USD (small values).
        // Since we know the rate is ~58.
        // Threshold: A single restock of 100 items @ $30 = $3000.
        // If it was converted, it would be 174,000.
        // Manual expenses like 45,000 (Salary) are clearly PHP inputs stored as raw numbers.

        // We will convert anything > 500 to USD by dividing by 58.
        // This is a heuristic, but necessary given the bad data state.
        // Note: Genuine USD large expenses > $500 will be affected, but in a POS demo context, expenses > $500 are rare unless it's rent/salary. 
        // If rent/salary count as PHP (e.g. 15000), they SHOULD be divided by 58 to be stored as USD.

        const RATE = 58;

        const expenses = await prisma.expense.findMany();

        for (const exp of expenses) {
            if (exp.amount > 500) {
                const newAmount = exp.amount / RATE;
                await prisma.expense.update({
                    where: { id: exp.id },
                    data: { amount: newAmount }
                });
                console.log(`Updated Expense #${exp.id}: ${exp.amount} -> ${newAmount.toFixed(2)} USD`);
            } else {
                console.log(`Skipping Expense #${exp.id}: ${exp.amount} USD (looks valid)`);
            }
        }

        console.log("✅ Expenses Normalized to USD.");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
