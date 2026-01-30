const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCounts() {
  console.log('--- Database Counts ---');
  const userCount = await prisma.user.count();
  const planCount = await prisma.plan.count();
  const productCount = await prisma.product.count();
  const memberCount = await prisma.member.count();
  const trainerCount = await prisma.trainer.count();

  const classCount = await prisma.class.count();
  const bookingCount = await prisma.booking.count();
  const orderCount = await prisma.order.count();
  const paymentCount = await prisma.payment.count();
  const auditLogCount = await prisma.auditLog.count();
  const rewardCount = await prisma.loyaltyReward.count();
  const notifCount = await prisma.notification.count();

  console.log(`Users: ${userCount}`);
  console.log(`Plans: ${planCount}`);
  console.log(`Products: ${productCount}`);
  console.log(`Members: ${memberCount}`);
  console.log(`Trainers: ${trainerCount}`);
  console.log(`Classes: ${classCount}`);
  console.log(`Bookings: ${bookingCount}`);
  console.log(`Orders: ${orderCount}`);
  console.log(`Payments: ${paymentCount}`);
  console.log(`Audit Logs: ${auditLogCount}`);
  console.log(`Rewards: ${rewardCount}`);
  console.log(`Notifications: ${notifCount}`);

  console.log('\n--- Product Names ---');
  const products = await prisma.product.findMany({ select: { name: true } });
  products.forEach(p => console.log(p.name));
}

checkCounts()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
