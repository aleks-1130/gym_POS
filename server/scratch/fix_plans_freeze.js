const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.plan.updateMany({
            where: {
                name: {
                    in: ['Annual Power', 'Half-Year Hustle', 'Quarter Crush', 'Monthly Fit']
                }
            },
            data: {
                freezeLimitCount: 5
            }
        });
        console.log(`✅ Updated ${result.count} plans to allow freezing (Limit: 5)`);
    } catch (error) {
        console.error('❌ Failed to update plans:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
