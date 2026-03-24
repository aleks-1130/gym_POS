const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting tenantId backfill for Global Members and Coupons...');
  
  // Backfill Members
  const members = await prisma.member.findMany();
  let mCount = 0;
  for (const member of members) {
      if (member.gymId) {
          const gym = await prisma.gym.findUnique({ where: { id: member.gymId }});
          if (gym && gym.tenantId !== member.tenantId) {
             await prisma.member.update({ where: { id: member.id }, data: { tenantId: gym.tenantId } });
             mCount++;
          }
      }
  }
  console.log(`Updated ${mCount} members to match their original Gym's tenantId.`);

  // Backfill Coupons
  const coupons = await prisma.coupon.findMany();
  let cCount = 0;
  for (const coupon of coupons) {
      if (coupon.gymId) {
          const gym = await prisma.gym.findUnique({ where: { id: coupon.gymId }});
          if (gym && gym.tenantId !== coupon.tenantId) {
             await prisma.coupon.update({ where: { id: coupon.id }, data: { tenantId: gym.tenantId } });
             cCount++;
          }
      }
  }
  console.log(`Updated ${cCount} coupons to match their original Gym's tenantId.`);
  
  console.log('Backfill complete!');
}

backfill().catch(console.error).finally(() => prisma.$disconnect());
