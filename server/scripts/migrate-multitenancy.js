const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Data Migration ---');

  // 1. Create Default Tenant
  let tenant = await prisma.tenant.findUnique({ where: { tenantId: 'FITOS-001' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        tenantId: 'FITOS-001',
        name: 'FitOS Business',
      },
    });
    console.log(`Created Tenant: ${tenant.name}`);
  }

  // 2. Create Default Gym
  let gym = await prisma.gym.findUnique({ where: { companyId: 'GYM-001' } });
  if (!gym) {
    gym = await prisma.gym.create({
      data: {
        tenantId: tenant.id,
        companyId: 'GYM-001',
        name: 'Main Branch',
        address: 'Global',
        phone: 'N/A',
        email: 'contact@fitos.com',
        referencePrefix: 'A321',
      },
    });
    console.log(`Created Gym: ${gym.name}`);
  }

  const gymId = gym.id;

  // 3. Update all tables
  const tables = [
    'user', 'auditLog', 'member', 'payment', 'accessLog', 'expense', 
    'trainingSession', 'paymentMethod', 'plan', 'classSessionPackage', 
    'paymentItem', 'supplier', 'product', 'category', 'stockOrder', 
    'stockOrderItem', 'trainer', 'trainerChangeRequest', 'trainerAvailability', 
    'sessionMaterial', 'class', 'classHistory', 'booking', 'classSession', 
    'order', 'orderItem', 'membershipPeriod', 'loyaltyReward', 
    'loyaltyTransaction', 'coupon', 'posConfig', 'receiptSettings', 
    'notification', 'memberNote', 'gymProfile', 'payrollConfig', 
    'promoCode', 'notificationPreference'
  ];

  for (const table of tables) {
    try {
      const result = await prisma[table].updateMany({
        where: { gymId: null },
        data: { gymId: gymId }
      });
      console.log(`Updated ${table}: ${result.count} rows`);
    } catch (err) {
      console.error(`Error updating ${table}:`, err.message);
    }
  }

  // 4. Update Users with TenantId
  try {
    // We use raw SQL because the client might still be in a state of flux or not yet generated with the field.
    // However, since we are using the client in this script, we can try using it if it's generated.
    // To be safe, let's use the client if it works, otherwise raw.
    console.log('Updating Users with tenantId...');
    const userResult = await prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id }
    });
    console.log(`Updated Users with TenantId: ${userResult.count} rows`);
  } catch (err) {
    console.error(`Error updating Users with TenantId:`, err.message);
    console.log('Falling back to raw SQL for User update...');
    const rawResult = await prisma.$executeRaw`UPDATE "User" SET "tenantId" = ${tenant.id} WHERE "tenantId" IS NULL`;
    console.log(`Updated Users with TenantId (Raw): ${rawResult} rows`);
  }

  console.log('--- Data Migration Completed ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
