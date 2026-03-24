const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const cats = await prisma.category.findMany({
      include: { gym: true }
    });
    console.log('Categories:', JSON.stringify(cats, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
