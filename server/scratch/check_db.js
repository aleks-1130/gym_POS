const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log('--- Tenants ---');
  console.log(tenants.map(t => ({ id: t.id, tenantId: t.tenantId, name: t.name })));

  const gyms = await prisma.gym.findMany();
  console.log('--- Gyms ---');
  console.log(gyms.map(g => ({ id: g.id, tenantId: g.tenantId, name: g.name })));

  const membersCount = await prisma.member.count();
  console.log('Total Members in DB:', membersCount);

  const sampleMembers = await prisma.member.findMany({ take: 5 });
  console.log('--- Sample Members ---');
  console.log(sampleMembers.map(m => ({ id: m.id, firstName: m.firstName, gymId: m.gymId, tenantId: m.tenantId, status: m.status })));

  const users = await prisma.user.findMany({ take: 5 });
  console.log('--- Sample Users ---');
  console.log(users.map(u => ({ id: u.id, email: u.email, role: u.role, gymId: u.gymId, tenantId: u.tenantId })));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
