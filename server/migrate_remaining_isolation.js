const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting multi-tenant data backfill...');

  const models = ['stockOrderItem', 'order', 'orderItem', 'membershipPeriod', 'productStock', 'sessionMaterial'];

  for (const modelName of models) {
    console.log(`Backfilling ${modelName}...`);
    try {
      const result = await prisma[modelName].updateMany({
        where: { tenantId: null },
        data: { tenantId: 1 }
      });
      console.log(`Updated ${result.count} ${modelName} records.`);
    } catch (e) {
      console.error(`Failed to update ${modelName}:`, e.message);
    }
  }

  console.log('Backfill complete.');
  await prisma.$disconnect();
}

migrate();
