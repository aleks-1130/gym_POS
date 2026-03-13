const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const migrations = await prisma.$queryRaw`SELECT * FROM "_prisma_migrations" ORDER BY "applied_steps_count" DESC LIMIT 5`;
    console.log('Last Migrations:', JSON.stringify(migrations, null, 2));
  } catch (e) {
    console.error('Error fetching migrations:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
