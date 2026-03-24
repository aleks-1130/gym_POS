const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('--- STARTING FINANCIAL & ACCESS LOG TENANT ID BACKFILL ---');
  
  const models = [
    'expense',
    'payment',
    'paymentItem',
    'accessLog'
  ];

  for (const model of models) {
    console.log(`Processing model: ${model}...`);
    const records = await prisma[model].findMany({
      where: { tenantId: null },
      include: { gym: true }
    });

    let updatedCount = 0;

    for (const record of records) {
      const targetTenantId = record.gym?.tenantId || 1;
      const isGlobal = !record.gymId;

      await prisma[model].update({
        where: { id: record.id },
        data: { 
            tenantId: targetTenantId,
            ...(model !== 'paymentItem' && model !== 'accessLog' ? { isGlobal } : {})
        }
      });
      updatedCount++;
    }
    console.log(`${model}: Updated ${updatedCount} records.`);
  }

  console.log('--- FINANCIAL BACKFILL COMPLETE ---');
}

backfill()
  .catch(e => console.error('Backfill failed:', e))
  .finally(() => prisma.$disconnect());
