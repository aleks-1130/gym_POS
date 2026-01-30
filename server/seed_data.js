const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const FIRST_NAMES = ['John', 'Jane', 'Mike', 'Alice', 'Tom', 'Sarah', 'David', 'Emma', 'James', 'Olivia', 'Robert', 'Sophia', 'William', 'Isabella', 'Richard', 'Mia', 'Joseph', 'Charlotte', 'Thomas', 'Amelia'];
const LAST_NAMES = ['Doe', 'Smith', 'Jones', 'Wong', 'Hardy', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Wood'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    console.log("🌱 Starting Comprehensive Database Seeding...");

    // 1. CLEAR EXISTING DATA
    console.log("🧹 Clearing existing data...");
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.accessLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.class.deleteMany();
    await prisma.member.deleteMany();
    await prisma.product.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.trainer.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.loyaltyReward.deleteMany();
    await prisma.auditLog.deleteMany();
    // Don't delete users if you want to keep login creds, but for 'whole database' we might as well reset or upsert.
    // We will upsert users so valid logins always exist.
    console.log("✨ Database cleared");

    // 2. SEED USERS (Staff/Admin/Owner)
    const userPassword = await bcrypt.hash('password123', 10);
    const users = [
        { email: 'owner@gym.com', name: 'Owner User', role: 'OWNER' },
        { email: 'admin@gym.com', name: 'Admin User', role: 'ADMIN' },
        { email: 'staff@gym.com', name: 'Staff User', role: 'STAFF' }
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: {
                email: u.email,
                name: u.name,
                password: userPassword,
                role: u.role
            }
        });
    }
    console.log("✅ Users seeded");

    // 3. SEED PLANS
    const plans = [
        { name: 'Day Pass', price: 15.00, duration: 1 },
        { name: 'Monthly Standard', price: 59.99, duration: 30 },
        { name: 'Yearly Pro', price: 599.99, duration: 365 },
        { name: 'Student Monthly', price: 39.99, duration: 30 }
    ];

    const dbPlans = [];
    for (const p of plans) {
        dbPlans.push(await prisma.plan.create({ data: p }));
    }
    console.log("✅ Plans seeded");

    // 4. SEED PRODUCTS
    const products = [
        { name: 'Whey Protein (Chocolate)', category: 'SUPPLEMENT', price: 49.99, stock: 50, minStock: 10, sku: 'SUPP-001' },
        { name: 'Pre-Workout (Fruit Punch)', category: 'SUPPLEMENT', price: 34.99, stock: 30, minStock: 5, sku: 'SUPP-002' },
        { name: 'Energy Drink', category: 'DRINK', price: 3.50, stock: 100, minStock: 20, sku: 'DRK-001' },
        { name: 'Water Bottle', category: 'MERCH', price: 12.00, stock: 40, minStock: 10, sku: 'MRC-001' },
        { name: 'Protein Bar', category: 'SUPPLEMENT', price: 2.50, stock: 200, minStock: 20, sku: 'SUPP-003' },
        { name: 'Gym T-Shirt', category: 'MERCH', price: 19.99, stock: 50, minStock: 10, sku: 'MRC-002' },
        { name: 'Lifting Straps', category: 'EQUIPMENT', price: 14.99, stock: 25, minStock: 5, sku: 'EQP-001' },
        { name: 'Towel', category: 'MERCH', price: 5.00, stock: 80, minStock: 15, sku: 'MRC-003' }
    ];

    const dbProducts = [];
    for (const p of products) {
        dbProducts.push(await prisma.product.create({ data: p }));
    }
    console.log("✅ Products seeded");

    // 5. SEED TRAINERS
    const trainersData = [
        { name: 'Arnold S.', specialty: 'Bodybuilding', bio: '7x Mr. Olympia. The legend.' },
        { name: 'Ronda R.', specialty: 'MMA / Boxing', bio: 'Former champion. Tough love.' },
        { name: 'Yoda', specialty: 'Mindfulness', bio: 'Do or do not, there is no try.' },
        { name: 'Usain B.', specialty: 'Cardio / Sprint', bio: 'Fastest man alive.' }
    ];

    const dbTrainers = [];
    for (const t of trainersData) {
        dbTrainers.push(await prisma.trainer.create({ data: t }));
    }
    console.log("✅ Trainers seeded");

    // 6. SEED CLASSES
    const classTypes = ['Yoga Flow', 'HIIT Blast', 'Boxing Fundamentals', 'Powerlifting', 'Zumba', 'Spin Class'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const times = ['06:00 AM', '08:00 AM', '10:00 AM', '05:00 PM', '07:00 PM'];

    const dbClasses = [];
    for (const day of days) {
        for (const time of times) {
            // 70% chance of a class existing at this slot
            if (Math.random() > 0.3) {
                const trainer = getRandomItem(dbTrainers);
                const cls = await prisma.class.create({
                    data: {
                        name: getRandomItem(classTypes),
                        trainerId: trainer.id,
                        dayOfWeek: day,
                        time: time,
                        duration: 60,
                        capacity: 20,
                        enrolled: 0
                    }
                });
                dbClasses.push(cls);
            }
        }
    }
    console.log(`✅ Classes seeded (${dbClasses.length})`);

    // 7. SEED LOYALTY REWARDS
    const rewards = [
        { name: 'Free Smoothie', cost: 100, description: 'One free smoothie from the bar.' },
        { name: 'Gym T-Shirt', cost: 500, description: 'Official branded t-shirt.' },
        { name: 'Personal Training Session', cost: 1000, description: '1 hour with a trainer.' },
        { name: 'One Month Free', cost: 5000, description: 'Waive next month membership.' }
    ];

    for (const r of rewards) {
        await prisma.loyaltyReward.create({ data: r });
    }
    console.log("✅ Loyalty Rewards seeded");

    // 8. SEED MEMBERS
    const memberPassword = await bcrypt.hash('password123', 10);
    const dbMembers = [];
    const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'EXPIRED', 'PENDING']; // Weighted towards ACTIVE

    for (let i = 0; i < 50; i++) {
        const firstName = getRandomItem(FIRST_NAMES);
        const lastName = getRandomItem(LAST_NAMES);
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
        const status = getRandomItem(statuses);
        const plan = getRandomItem(dbPlans);

        const member = await prisma.member.create({
            data: {
                firstName,
                lastName,
                email,
                password: memberPassword,
                status,
                phone: `555-01${i.toString().padStart(2, '0')}`,
                planId: plan.id,
                startDate: new Date(),
                expiryDate: status === 'EXPIRED' ? new Date(Date.now() - 86400000 * 10) : new Date(Date.now() + 86400000 * 30),
                points: getRandomInt(0, 5000)
            }
        });
        dbMembers.push(member);
    }
    console.log(`✅ Members seeded (${dbMembers.length})`);

    // 9. SEED BOOKINGS
    for (const cls of dbClasses) {
        const attendeesCount = getRandomInt(0, Math.min(cls.capacity, 10)); // 0 to 10 attendees
        for (let i = 0; i < attendeesCount; i++) {
            const member = getRandomItem(dbMembers);
            // Simple check to avoid duplicate booking for same member/class
            const exists = await prisma.booking.findFirst({
                where: { memberId: member.id, classId: cls.id }
            });
            if (!exists) {
                await prisma.booking.create({
                    data: {
                        memberId: member.id,
                        classId: cls.id,
                        status: 'CONFIRMED'
                    }
                });
                // Increment enrolled count
                await prisma.class.update({
                    where: { id: cls.id },
                    data: { enrolled: { increment: 1 } }
                });
            }
        }
    }
    console.log("✅ Bookings seeded");

    // 10. SEED ORDERS & PAYMENTS
    for (const member of dbMembers) {
        // 50% chance member bought something
        if (Math.random() > 0.5) {
            const orderItemsCount = getRandomInt(1, 4);
            let total = 0;
            const orderItemsData = [];

            for (let k = 0; k < orderItemsCount; k++) {
                const product = getRandomItem(dbProducts);
                const quantity = getRandomInt(1, 3);
                total += product.price * quantity;
                orderItemsData.push({
                    productId: product.id,
                    quantity: quantity,
                    price: product.price
                });
            }

            const order = await prisma.order.create({
                data: {
                    memberId: member.id,
                    total: total,
                    status: 'COMPLETED',
                    items: {
                        create: orderItemsData
                    }
                }
            });

            // Corresponding Payment
            await prisma.payment.create({
                data: {
                    amount: total,
                    type: 'POS',
                    method: getRandomItem(['CARD', 'CASH']),
                    status: 'COMPLETED',
                    memberId: member.id,
                    date: new Date()
                }
            });
        }

        // Membership Payment
        if (member.status === 'ACTIVE') {
            const plan = dbPlans.find(p => p.id === member.planId);
            await prisma.payment.create({
                data: {
                    amount: plan ? plan.price : 50.00,
                    type: 'MEMBERSHIP',
                    method: 'CARD',
                    status: 'COMPLETED',
                    memberId: member.id,
                    date: new Date(Date.now() - getRandomInt(0, 30) * 86400000)
                }
            });
        }
    }
    console.log("✅ Orders & Payments seeded");

    // 11. SEED NOTIFICATIONS
    const notifications = [
        { title: 'Gym Closed Holiday', message: 'We will be closed on New Year\'s Day.', type: 'INFO' },
        { title: 'New Yoga Class', message: 'Check out the new sunrise yoga session.', type: 'PROMO' },
        { title: 'Membership Due', message: 'Reminder to renewable your subscription.', type: 'ALERT' }
    ];
    for (const n of notifications) {
        await prisma.notification.create({ data: n });
    }
    console.log("✅ Notifications seeded");

    // 12. SEED AUDIT LOG
    await prisma.auditLog.create({
        data: {
            action: 'LOGIN',
            performedBy: 'admin@gym.com',
            details: 'Admin logged in from web portal'
        }
    });
    await prisma.auditLog.create({
        data: {
            action: 'UPDATE_INVENTORY',
            performedBy: 'staff@gym.com',
            details: 'Restocked Protein Bars'
        }
    });
    console.log("✅ Audit Logs seeded");

    console.log("🚀 FULL Database successfully populated!");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
