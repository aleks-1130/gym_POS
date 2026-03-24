const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const tenantCount = await prisma.tenant.count().catch(() => -1);
    const userCount = await prisma.user.count().catch(() => -1);
    const memberCount = await prisma.member.count().catch(() => -1);
    
    console.log('--- DATABASE STATUS ---');
    console.log('Tenant count:', tenantCount);
    console.log('User count:', userCount);
    console.log('Member count:', memberCount);
    
    if (tenantCount > 0) {
      const tenants = await prisma.tenant.findMany({ take: 5 });
      console.log('Sample Tenants:', JSON.stringify(tenants, null, 2));
    } else if (tenantCount === 0) {
      console.log('CRITICAL: Tenant table is EMPTY.');
    } else {
      console.log('CRITICAL: Tenant table does NOT EXIST or query failed.');
    }
  } catch (e) {
    console.error('Check failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
