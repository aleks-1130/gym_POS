const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Applying safe schema updates...');
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN NOT NULL DEFAULT false;`);
        console.log('Updated Booking table.');
        
        await prisma.$executeRawUnsafe(`ALTER TABLE "TrainingSession" ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN NOT NULL DEFAULT false;`);
        console.log('Updated TrainingSession table.');
        
        console.log('Schema updates completed successfully.');
    } catch (error) {
        console.error('Error applying schema updates:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
