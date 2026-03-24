const prisma = require('../src/config/prisma');
const { runWithContext } = require('../src/utils/context');

async function debugAPI() {
  console.log('--- Simulating getMembers via Controller Logic ---');
  
  await runWithContext({ gymId: 2, tenantId: 1, role: 'ADMIN' }, async () => {
    // Replicating getMembers logic
    const { branchId } = { branchId: '2' }; // Simulating "This Branch" selection
    const baseWhere = { status: { not: 'DELETED' } };
    if (branchId) baseWhere.gymId = Number(branchId);
    
    const members = await prisma.member.findMany({
      where: baseWhere,
      include: { 
        plan: true,
        gym: { select: { id: true, name: true } }
      },
      take: 10
    });
    
    console.log('API Sample Results (Filtered by branchId=2):');
    console.log(JSON.stringify(members, null, 2));
    
    const unfilteredMembers = await prisma.member.findMany({
      where: { status: { not: 'DELETED' } },
      include: { gym: { select: { name: true } } },
      take: 10
    });
    console.log('API Sample Results (Unfiltered):');
    console.log(JSON.stringify(unfilteredMembers, null, 2));
  });

  await prisma.$disconnect();
}

debugAPI().catch(console.error);
