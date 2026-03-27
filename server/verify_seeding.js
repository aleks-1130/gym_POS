const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const tenants = await prisma.tenant.count();
    const gyms = await prisma.gym.count();
    const users = await prisma.user.count();
    const categories = await prisma.category.count();
    
    console.log('--- Database Status ---');
    console.log(`Tenants: ${tenants}`);
    console.log(`Gyms: ${gyms}`);
    console.log(`Users: ${users}`);
    console.log(`Categories: ${categories}`);
    
    if (tenants > 0 && gyms > 0 && users > 0 && categories > 0) {
      console.log('SUCCESS: Seeding and Migration verified.');
    } else {
      console.log('FAILURE: Missing expected data.');
    }
  } catch (e) {
    console.error('Error during verification:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
