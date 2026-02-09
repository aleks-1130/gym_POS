const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log("=== Backfilling Missing Training Payments ===");

    // Get all sessions
    const sessions = await prisma.trainingSession.findMany({
        include: { member: true, trainer: true }
    });

    console.log(`Found ${sessions.length} training sessions.`);

    let createdCount = 0;

    for (const session of sessions) {
        // Look for EXISTING payment for this session
        // Strategy: Same Member, Same Amount, Same Day (+/- 1m buffer?)
        // Or if we can't find it, we create it.

        const sessionDate = new Date(session.date);
        const start = new Date(sessionDate); start.setHours(0, 0, 0, 0);
        const end = new Date(sessionDate); end.setHours(23, 59, 59, 999);

        const existingPayment = await prisma.payment.findFirst({
            where: {
                memberId: session.memberId,
                type: { in: ['TRAINING', 'SERVICE'] },
                amount: session.price,
                date: { gte: start, lte: end }
            }
        });

        if (!existingPayment) {
            console.log(`[MISSING] Session #${session.id} (${session.date.toISOString().split('T')[0]}) - ${session.member.firstName} - ${session.price}`);

            // Create Payment
            await prisma.payment.create({
                data: {
                    amount: session.price,
                    type: 'TRAINING',
                    method: 'CASH', // Assume Cash for backfill
                    status: 'COMPLETED', // Assume paid if session exists
                    memberId: session.memberId,
                    date: session.date // Match session date
                }
            });
            createdCount++;
        } else {
            console.log(`[EXISTS] Session #${session.id} linked to Payment #${existingPayment.id}`);
        }
    }

    console.log(`\n=== DONE ===`);
    console.log(`Created ${createdCount} missing payments.`);
}

fix()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
