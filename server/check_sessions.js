const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const sessions = await prisma.trainingSession.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                member: { select: { firstName: true, lastName: true, id: true } },
                trainer: { select: { name: true, id: true } }
            }
        });

        console.log('--- RECENT TRAINING SESSIONS ---');
        sessions.forEach(s => {
            console.log(`ID: ${s.id}, Member: ${s.member.firstName} ${s.member.lastName} (ID: ${s.member.id}), Status: ${s.status}, PayStatus: ${s.paymentStatus}, Method: ${s.paymentMethod}, CreatedAt: ${s.createdAt}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

check();
