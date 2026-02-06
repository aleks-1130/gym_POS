const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    // Reset to start of current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    console.log(`\n📅 Auditing Revenue from: ${firstDayOfMonth.toLocaleString()}`);
    console.log("---------------------------------------------------");

    const payments = await prisma.payment.findMany({
        where: {
            date: {
                gte: firstDayOfMonth
            }
        },
        include: {
            member: {
                select: { firstName: true, lastName: true, email: true }
            }
        },
        orderBy: {
            date: 'desc'
        }
    });

    let total = 0;

    if (payments.length === 0) {
        console.log("No payments found for this month.");
    } else {
        console.log(`Found ${payments.length} payment records:\n`);
        console.log("ID | Date       | Amount ($) | Member/Source        | Type");
        console.log("---|------------|------------|----------------------|---------");

        payments.forEach(p => {
            total += p.amount;
            const dateStr = p.date.toISOString().split('T')[0];
            const name = p.member ? `${p.member.firstName} ${p.member.lastName}` : (p.guestName || 'Unknown/Guest');
            console.log(`${p.id.toString().padEnd(2)} | ${dateStr} | $${p.amount.toFixed(2).padEnd(9)} | ${name.padEnd(20)} | ${p.type}`);
        });
    }

    console.log("---------------------------------------------------");
    console.log(`💰 Total Monthly Revenue (USD): $${total.toFixed(2)}`);
    // Assuming hardcoded rate of 58 for display consistency check
    console.log(`🇵🇭 Est. Total in PHP (Rate 58): ₱${(total * 58).toLocaleString()}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
