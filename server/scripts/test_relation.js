const prisma = require('../src/config/prisma');

async function testRelation() {
  const member = await prisma.member.findFirst({
    where: { firstName: 'alex', lastName: 'samp' },
    include: { gym: { select: { name: true } } }
  });
  
  console.log('Result for alex samp:');
  console.log(JSON.stringify(member, null, 2));
  
  if (member && member.gym && member.gym.name) {
      console.log('SUCCESS: Relation found:', member.gym.name);
  } else {
      console.log('FAILURE: Relation missing or gym name null');
      console.log('Member object keys:', Object.keys(member || {}));
      if (member && member.gym) console.log('Gym object keys:', Object.keys(member.gym));
  }
}

testRelation().then(() => prisma.$disconnect());
