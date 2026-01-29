const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting Database Seeding...");

    // 1. CLEAR EXISTING DATA (Optional, but good for clean slate if needed. Commented out to be safe, or just use upsert)
    // await prisma.accessLog.deleteMany();
    // await prisma.payment.deleteMany();
    // await prisma.member.deleteMany();
    // await prisma.product.deleteMany();

    // 2. SEED PLANS
    const plans = [
        { name: 'Day Pass', price: 15.00, duration: 1 },
        { name: 'Monthly Standard', price: 59.99, duration: 30 },
        { name: 'Yearly Pro', price: 599.99, duration: 365 },
        { name: 'Student Monthly', price: 39.99, duration: 30 }
    ];

    for (const p of plans) {
        await prisma.plan.create({ data: p });
    }
    console.log("✅ Plans seeded");

    // 3. SEED PRODUCTS
    const products = [
        { name: 'Whey Protein (Chocolate)', category: 'SUPPLEMENT', price: 49.99, stock: 20, minStock: 5, imageUrl: 'https://m.media-amazon.com/images/I/61JSj3o16jL._AC_SX679_.jpg' },
        { name: 'Pre-Workout (Fruit Punch)', category: 'SUPPLEMENT', price: 34.99, stock: 15, minStock: 5 },
        { name: 'Energy Drink', category: 'DRINK', price: 3.50, stock: 100, minStock: 20 },
        { name: 'Protein Bar', category: 'SUPPLEMENT', price: 2.50, stock: 50, minStock: 10 },
        { name: 'Gym T-Shirt', category: 'MERCH', price: 19.99, stock: 30, minStock: 5 },
        { name: 'Lifting Straps', category: 'EQUIPMENT', price: 14.99, stock: 10, minStock: 2 }
    ];

    for (const p of products) {
        await prisma.product.create({ data: p });
    }
    console.log("✅ Products seeded");

    // 4. SEED MEMBERS
    const password = await bcrypt.hash('password123', 10);
    const memberData = [
        { firstName: 'John', lastName: 'Doe', email: 'john@doe.com', status: 'ACTIVE', points: 150 },
        { firstName: 'Jane', lastName: 'Smith', email: 'jane@smith.com', status: 'ACTIVE', points: 340 },
        { firstName: 'Mike', lastName: 'Jones', email: 'mike@jones.com', status: 'EXPIRED', points: 20 },
        { firstName: 'Alice', lastName: 'Wong', email: 'alice@wong.com', status: 'PENDING', points: 0 },
        { firstName: 'Tom', lastName: 'Hardy', email: 'tom@venom.com', status: 'ACTIVE', points: 500 }
    ];

    const dbMembers = [];
    for (const m of memberData) {
        // Assign random plan
        const plan = await prisma.plan.findFirst();
        const member = await prisma.member.create({
            data: {
                ...m,
                password,
                planId: plan.id,
                expiryDate: m.status === 'EXPIRED' ? new Date(Date.now() - 86400000 * 5) : new Date(Date.now() + 86400000 * 30)
            }
        });
        dbMembers.push(member);
    }
    console.log("✅ Members seeded");

    // 5. SEED PAYMENTS (Revenue Data)
    for (const member of dbMembers) {
        // Create 3-5 random payments for each
        const count = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < count; i++) {
            await prisma.payment.create({
                data: {
                    amount: (Math.random() * 100).toFixed(2) * 1,
                    type: 'POS',
                    method: 'CARD',
                    memberId: member.id,
                    date: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)) // Random time in last 7 days
                }
            });
        }
    }
    console.log("✅ Payments seeded");

    // 6. SEED ACCESS LOGS
    for (const member of dbMembers) {
        await prisma.accessLog.create({
            data: {
                memberId: member.id,
                status: 'ALLOWED',
                checkIn: new Date()
            }
        });
    }
    console.log("✅ Access Logs seeded");

    // 7. SEED TRAINERS
    const trainers = [
        { name: 'Arnold S.', specialty: 'Bodybuilding', bio: 'Legendary lifter.' },
        { name: 'Ronda R.', specialty: 'MMA / Boxing', bio: 'Champion fighter.' },
        { name: 'Yoda', specialty: 'Mental Focus', bio: 'Do or do not.' }
    ];

    for (const t of trainers) {
        await prisma.trainer.create({ data: t });
    }
    console.log("✅ Trainers seeded");

    console.log("🚀 Database successfully populated!");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
