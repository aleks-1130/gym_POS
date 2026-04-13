const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
prisma.member.delete({where:{id:20}})
    .catch(e => console.error('DB_ERROR:', e.message))
    .finally(() => prisma.$disconnect());
