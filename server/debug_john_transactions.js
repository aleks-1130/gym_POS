const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJohnDoe() {
    try {
        const member = await prisma.member.findFirst({
            where: { firstName: 'John', lastName: 'Doe' }
        });

        console.log('John Doe Member:', member ? `ID: ${member.id}, Email: ${member.email}` : 'NOT FOUND');

        if (member) {
            const payments = await prisma.payment.findMany({
                where: { memberId: member.id },
                include: { items: true }
            });

            console.log(`\nTotal Payments for John Doe: ${payments.length}`);
            payments.forEach(p => {
                console.log(`- ID:${p.id} Amt:${p.amount} Type:${p.type} Date:${p.date.toISOString().split('T')[0]} Items:${p.items.length}`);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkJohnDoe();
