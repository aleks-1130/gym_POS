const prisma = require('./src/config/prisma');
const bcrypt = require('bcryptjs');

async function fixJohnDoe() {
    try {
        console.log("Fixing 'john@doe.com'...");

        const hashedPassword = await bcrypt.hash('password123', 10);

        // Upsert Member
        const member = await prisma.member.upsert({
            where: { email: 'john@doe.com' },
            update: {
                password: hashedPassword,
                status: 'ACTIVE'
            },
            create: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@doe.com',
                password: hashedPassword,
                status: 'ACTIVE',
                points: 100,
                startDate: new Date(),
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            }
        });

        console.log("Member 'john@doe.com' ensures with password 'password123'");
        console.log("ID:", member.id);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

fixJohnDoe();
