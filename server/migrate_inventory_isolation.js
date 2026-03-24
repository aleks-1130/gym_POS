const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('--- STARTING FINAL TENANT ID BACKFILL WITH DUPLICATE HANDLING ---');
  
  const models = [
    'product',
    'category',
    'supplier',
    'stockOrder',
    'loyaltyReward',
    'posConfig',
    'receiptSettings',
    'payrollConfig'
  ];

  for (const model of models) {
    try {
      console.log(`Processing model: ${model}...`);
      const records = await prisma[model].findMany({
        where: { tenantId: null },
        include: { gym: true }
      });

      let updatedCount = 0;
      let deletedCount = 0;

      for (const record of records) {
        const targetTenantId = record.gym?.tenantId || 1;
        const isGlobal = !record.gymId;

        try {
          await prisma[model].update({
            where: { id: record.id },
            data: { tenantId: targetTenantId, isGlobal }
          });
          updatedCount++;
        } catch (err) {
          if (err.code === 'P2002') {
            console.log(`Duplicate found for ${model} ID ${record.id} in Tenant ${targetTenantId}. Deleting...`);
            // Special handling for Category duplicates: reassign products first
            if (model === 'category') {
                // Find the existing category with same name for this tenant
                const existing = await prisma.category.findFirst({
                    where: { name: record.name, tenantId: targetTenantId }
                });
                if (existing) {
                    // Update any products using the old category name/id
                    // Since Category is just a string in Product model right now (WAIT, I should check that)
                    // Product schema: category String. 
                    // So we don't have a direct relation between Product and Category ID? 
                    // Yes, schema.prisma line 426: category String.
                    // So deleting the category is safe as long as the name still exists.
                }
            }
            await prisma[model].delete({ where: { id: record.id } });
            deletedCount++;
          } else {
            console.error(`Error updating ${model} ID ${record.id}:`, err.message);
          }
        }
      }
      console.log(`${model}: Updated ${updatedCount}, Deleted ${deletedCount} duplicates.`);
    } catch (e) {
      console.error(`Failed to process model ${model}:`, e.message);
    }
  }

  console.log('--- BACKFILL COMPLETE ---');
}

backfill()
  .catch(e => console.error('Backfill failed:', e))
  .finally(() => prisma.$disconnect());
