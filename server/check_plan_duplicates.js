const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking for duplicate PLANS...");
    const plans = await prisma.plan.findMany();
    const nameCounts = {};

    plans.forEach(p => {
        nameCounts[p.name] = (nameCounts[p.name] || 0) + 1;
    });

    const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);

    if (duplicates.length > 0) {
        console.log("Found duplicate PLANS:");
        duplicates.forEach(([name, count]) => {
            console.log(`- ${name}: ${count} copies`);
        });
    } else {
        console.log("No duplicate PLANS found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
