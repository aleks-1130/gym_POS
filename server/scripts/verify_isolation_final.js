const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('--- Data Isolation Verification ---');

    const gymA = 1;
    const gymB = 2;
    const tenantId = 1;

    // 1. Create a trainer in Gym A
    console.log('Creating trainer in Gym A...');
    const trainerA = await prisma.trainer.create({
        data: {
            name: 'Gym A Trainer',
            type: 'FULLTIME',
            specialty: 'Pilates',
            gymId: gymA,
            tenantId: tenantId
        }
    });

    // 2. Fetch trainers for Gym B (Should NOT see Trainer A)
    console.log('Fetching trainers for Gym B...');
    const trainersB = await prisma.trainer.findMany({
        where: { gymId: gymB, tenantId: tenantId }
    });

    const isIsolated = !trainersB.some(t => t.id === trainerA.id);
    console.log(`Isolation Check (Trainer A in Gym B results): ${isIsolated ? 'PASSED' : 'FAILED'}`);

    // 3. Create a class in Gym A
    console.log('Creating class in Gym A...');
    const classA = await prisma.class.create({
        data: {
            name: 'Gym A Class',
            trainerId: trainerA.id,
            gymId: gymA,
            tenantId: tenantId,
            scheduleType: 'RECURRING',
            dayOfWeek: 'Monday',
            time: '08:00 AM',
            duration: 60,
            capacity: 10
        }
    });

    // 4. Fetch classes for Gym B (Should NOT see Class A)
    console.log('Fetching classes for Gym B...');
    const classesB = await prisma.class.findMany({
        where: { gymId: gymB, tenantId: tenantId }
    });

    const classIsIsolated = !classesB.some(c => c.id === classA.id);
    console.log(`Isolation Check (Class A in Gym B results): ${classIsIsolated ? 'PASSED' : 'FAILED'}`);

    // Cleanup
    console.log('Cleaning up test records...');
    await prisma.class.delete({ where: { id: classA.id } });
    await prisma.trainer.delete({ where: { id: trainerA.id } });

    console.log('--- Verification Complete ---');
}

verify()
    .catch((err) => console.error(err))
    .finally(() => prisma.$disconnect());
