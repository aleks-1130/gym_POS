
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.trainingSession.groupBy({
        by: ['status'],
        _count: {
            status: true
        }
    });
    console.log("Session Status Counts:", counts);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
