const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const s = await prisma.trainingSession.findUnique({
            where: { id: 231 },
            include: { materials: true }
        });
        console.log("SESSION_DATA:", JSON.stringify(s, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
