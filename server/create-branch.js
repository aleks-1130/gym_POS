const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createBranch(name, companyId) {
  try {
    // 1. Get the first tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.error('No tenant found. Please run seed script first.');
      return;
    }

    // 2. Create the Gym
    const newGym = await prisma.gym.create({
      data: {
        name,
        companyId,
        tenantId: tenant.id,
        currency: 'PHP',
        taxRate: 12.0
      }
    });

    console.log(`--- New Branch Created ---`);
    console.log(`ID: ${newGym.id}`);
    console.log(`Name: ${newGym.name}`);
    console.log(`Company ID: ${newGym.companyId}`);
    console.log(`--------------------------`);
    
    return newGym;
  } catch (error) {
    if (error.code === 'P2002') {
        console.error(`Error: Company ID "${companyId}" already exists.`);
    } else {
        console.error('Error creating branch:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Usage: node create-branch.js "My New Branch" "BRANCH-001"
const args = process.argv.slice(2);
const name = args[0] || 'Modern Fitness SM';
const codename = args[1] || `MF-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

createBranch(name, codename);
