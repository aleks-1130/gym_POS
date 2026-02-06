const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting Database Seeding...");

    // 0. SEED USERS (Staff/Admin/Owner)
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
    console.log("✅ Users (Owner/Admin/Staff) seeded");

    // 10. SEED SUPPLIERS (Moved up for dependency)
    const suppliers = [
        { name: 'Gym Pro Supplies', contact: 'John Sales', email: 'sales@gympro.com', address: '123 Warehouse Dr', notes: 'Main equipment supplier' },
        { name: 'NutriWhole Wholesale', contact: 'Alice Nutrition', email: 'alice@nutriwhole.com', address: '456 Wellness Blvd', notes: 'Supplements' },
        { name: 'CleanTech Solutions', contact: 'Bob Cleaner', email: 'bob@cleantech.com', address: '789 San Ildefonso', notes: 'Cleaning supplies' }
    ];

    const dbSuppliers = [];
    for (const s of suppliers) {
        let supplier = await prisma.supplier.findFirst({ where: { name: s.name } });
        if (!supplier) {
            supplier = await prisma.supplier.create({ data: s });
            console.log(`Created Supplier: ${s.name}`);
        } else {
            console.log(`Supplier exists: ${s.name}`);
        }
        dbSuppliers.push(supplier);
    }
    console.log("✅ Suppliers seeded");

    // 2. SEED PLANS (PHP Prices)
    const plans = [
        { name: 'Yearly Pro', price: 12000, duration: 365 },
        { name: 'Monthly Standard', price: 1500, duration: 30 },
        { name: 'Student Monthly', price: 1000, duration: 30 },
        { name: 'Day Pass', price: 300.00, duration: 1 }
    ];

    for (const p of plans) {
        const existing = await prisma.plan.findFirst({ where: { name: p.name } });
        if (!existing) {
            await prisma.plan.create({ data: p });
            console.log(`Created Plan: ${p.name}`);
        } else {
            await prisma.plan.update({
                where: { id: existing.id },
                data: { price: p.price }
            });
            console.log(`Updated Plan Price: ${p.name}`);
        }
    }
    console.log("✅ Plans seeded");

    // 3. SEED PRODUCTS (PHP Prices)
    const products = [
        { name: 'Whey Protein (Chocolate)', category: 'SUPPLEMENT', price: 2800.00, stock: 20, minStock: 5, imageUrl: '/products/whey_protein_chocolate.png', supplierIndex: 1 },
        { name: 'Pre-Workout (Fruit Punch)', category: 'SUPPLEMENT', price: 1900.00, stock: 15, minStock: 5, imageUrl: '/products/pre_workout_fruit.png', supplierIndex: 1 },
        { name: 'Energy Drink', category: 'DRINK', price: 120.00, stock: 100, minStock: 20, imageUrl: '/products/energy_drink.png', supplierIndex: 1 },
        { name: 'Protein Bar', category: 'SUPPLEMENT', price: 80.00, stock: 50, minStock: 10, imageUrl: '/products/protein_bar.png', supplierIndex: 1 },
        { name: 'Gym T-Shirt', category: 'MERCH', price: 800.00, stock: 30, minStock: 5, imageUrl: '/products/gym_tshirt.png', supplierIndex: 0 },
        { name: 'Lifting Straps', category: 'EQUIPMENT', price: 600.00, stock: 10, minStock: 2, imageUrl: '/products/lifting_straps.png', supplierIndex: 0 },
        { name: 'Energy Drink - Zero Sugar', category: 'DRINK', price: 120.00, stock: 50, minStock: 10, imageUrl: '/products/energy_drink_zero.png', supplierIndex: 1 },
        { name: 'Gym Shark Water Bottle', category: 'EQUIPMENT', price: 1200.00, stock: 15, minStock: 5, imageUrl: '/products/gym_shark_bottle.png', supplierIndex: 0 },
        { name: 'Pre-Workout - Blue Raz', category: 'SUPPLEMENT', price: 1900.00, stock: 20, minStock: 5, imageUrl: '/products/pre_workout_blue.png', supplierIndex: 1 }
    ];

    for (const p of products) {
        const { supplierIndex, ...productData } = p;
        const supplierId = dbSuppliers[supplierIndex] ? dbSuppliers[supplierIndex].id : null;
        const supplyCost = Number((productData.price * 0.6).toFixed(2));

        const existing = await prisma.product.findFirst({ where: { name: p.name } });
        if (!existing) {
            await prisma.product.create({
                data: {
                    ...productData,
                    supplierId,
                    supplyCost
                }
            });
        } else {
            await prisma.product.update({
                where: { id: existing.id },
                data: {
                    supplierId,
                    supplyCost,
                    price: productData.price
                }
            });
        }
    }
    console.log("✅ Products seeded and relations updated");

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
        const plan = await prisma.plan.findFirst();
        const member = await prisma.member.upsert({
            where: { email: m.email },
            update: {},
            create: {
                ...m,
                password,
                planId: plan ? plan.id : null,
                expiryDate: m.status === 'EXPIRED' ? new Date(Date.now() - 86400000 * 5) : new Date(Date.now() + 86400000 * 30)
            }
        });
        dbMembers.push(member);
    }
    console.log("✅ Members seeded");

    // 5. SEED PAYMENTS
    for (const member of dbMembers) {
        const count = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < count; i++) {
            await prisma.payment.create({
                data: {
                    amount: (Math.random() * 1000 + 500).toFixed(2) * 1, // Higher PHP amounts
                    type: 'POS',
                    method: 'CARD',
                    memberId: member.id,
                    date: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
                }
            });
        }
    }
    console.log("✅ Payments seeded");

    // 6. ACCESS LOGS
    for (const member of dbMembers) {
        await prisma.accessLog.create({
            data: { memberId: member.id, status: 'ALLOWED', checkIn: new Date() }
        });
    }
    console.log("✅ Access Logs seeded");

    // 7. SEED TRAINERS (PHP Session Prices)
    const trainers = [
        {
            name: 'Arnold S.',
            specialization: 'Bodybuilding Coach',
            specialty: 'Bodybuilding',
            bio: 'Former Mr. Olympia.',
            experience: 20, rating: 4.9, sessionPrice: 1500.00, availableSlots: 3,
            specialties: 'Strength Training,Muscle Building,Bodybuilding,Nutrition',
            imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop'
        },
        {
            name: 'Ronda R.',
            specialization: 'Combat Sports Trainer',
            specialty: 'MMA / Boxing',
            bio: 'Champion fighter.',
            experience: 15, rating: 4.8, sessionPrice: 1600.00, availableSlots: 2,
            specialties: 'MMA,Boxing,Self-Defense,Cardio,Agility',
            imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop'
        },
        {
            name: 'Sarah Chen',
            specialization: 'Yoga & Flexibility',
            specialty: 'Yoga & Flexibility',
            bio: 'Certified yoga instructor.',
            experience: 10, rating: 4.9, sessionPrice: 900.00, availableSlots: 4,
            specialties: 'Yoga,Pilates,Flexibility,Mobility,Mindfulness',
            imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop'
        },
        {
            name: 'Marcus Johnson',
            specialization: 'CrossFit Coach',
            specialty: 'CrossFit',
            bio: 'CrossFit coach.',
            experience: 12, rating: 4.8, sessionPrice: 1200.00, availableSlots: 2,
            specialties: 'CrossFit,Olympic Lifting',
            imageUrl: 'https://images.unsplash.com/photo-1500595046891-32b56a8e7eb9?w=400&h=400&fit=crop'
        }
    ];

    const dbTrainers = [];
    for (const t of trainers) {
        let trainer = await prisma.trainer.findFirst({ where: { name: t.name } });
        if (!trainer) {
            trainer = await prisma.trainer.create({ data: t });
        } else {
            trainer = await prisma.trainer.update({
                where: { id: trainer.id },
                data: { sessionPrice: t.sessionPrice }
            });
        }
        dbTrainers.push(trainer);
    }
    console.log("✅ Trainers seeded");

    // 8. SEED TRAINING SESSIONS
    for (const member of dbMembers) {
        const sessionCount = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < sessionCount; i++) {
            const randomTrainer = dbTrainers[Math.floor(Math.random() * dbTrainers.length)];
            const daysAgo = Math.floor(Math.random() * 30);
            await prisma.trainingSession.create({
                data: {
                    memberId: member.id,
                    trainerId: randomTrainer.id,
                    date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
                    duration: 60,
                    price: randomTrainer.sessionPrice,
                    status: daysAgo > 3 ? 'COMPLETED' : 'SCHEDULED',
                    notes: 'Keep it up!'
                }
            });
        }
    }
    console.log("✅ Training Sessions seeded");

    // 8.5. SEED CLASSES
    const classes = [
        { name: 'Yoga 101', dayOfWeek: 'Monday', time: '10:00 AM', duration: 60, capacity: 20 },
        { name: 'HIIT Blast', dayOfWeek: 'Tuesday', time: '6:00 PM', duration: 45, capacity: 15 },
        { name: 'Spin Class', dayOfWeek: 'Wednesday', time: '5:30 PM', duration: 45, capacity: 25 },
        { name: 'Power Lifting', dayOfWeek: 'Thursday', time: '7:00 PM', duration: 90, capacity: 10 },
        { name: 'Zumba Party', dayOfWeek: 'Friday', time: '6:00 PM', duration: 60, capacity: 30 },
        { name: 'Morning Stretch', dayOfWeek: 'Saturday', time: '8:00 AM', duration: 30, capacity: 20 }
    ];

    for (const c of classes) {
        const randomTrainer = dbTrainers[Math.floor(Math.random() * dbTrainers.length)];
        const existing = await prisma.class.findFirst({
            where: { name: c.name, dayOfWeek: c.dayOfWeek }
        });

        if (!existing) {
            await prisma.class.create({
                data: { ...c, trainerId: randomTrainer.id }
            });
        }
    }
    console.log("✅ Classes seeded");

    // 8.6. SEED BOOKINGS (Participants)
    const dbClasses = await prisma.class.findMany();
    for (const cls of dbClasses) {
        const participantsCount = Math.floor(Math.random() * 6); // 0 to 5
        const shuffledMembers = dbMembers.sort(() => 0.5 - Math.random());
        const selectedMembers = shuffledMembers.slice(0, participantsCount);

        for (const member of selectedMembers) {
            const existingBooking = await prisma.booking.findFirst({
                where: { classId: cls.id, memberId: member.id }
            });

            if (!existingBooking) {
                await prisma.booking.create({
                    data: { classId: cls.id, memberId: member.id, status: 'CONFIRMED' }
                });
            }
        }

        const enrolledCount = await prisma.booking.count({ where: { classId: cls.id } });
        await prisma.class.update({
            where: { id: cls.id },
            data: { enrolled: enrolledCount }
        });
    }
    console.log("✅ Bookings seeded (Participants added)");

    // 9. LOYALTY REWARDS
    const rewards = [
        { name: 'Premium Gym Towel', cost: 250, category: 'MERCHANDISE', description: 'Towel', imageUrl: 'https://images.unsplash.com/photo-1595777707802-c2d353eadc00?w=400&h=400&fit=crop' },
        { name: 'Protein Powder (2kg)', cost: 500, category: 'SUPPLEMENT', description: 'Whey', imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop' }
    ];
    for (const reward of rewards) {
        const existing = await prisma.loyaltyReward.findFirst({ where: { name: reward.name } });
        if (!existing) await prisma.loyaltyReward.create({ data: reward });
    }
    console.log("✅ Loyalty Rewards seeded");

    // 11. SEED EXPENSES (Budget Friendly)
    const expenses = [
        { title: 'Electricity Bill', amount: 3500.00, category: 'UTILITIES', date: new Date(), notes: 'Current Bill' },
        { title: 'Water Bill', amount: 800.00, category: 'UTILITIES', date: new Date(), notes: 'Current Bill' },
        { title: 'Staff Salary', amount: 18000.00, category: 'SALARY', date: new Date(), notes: 'Monthly Payroll' },
        { title: 'Cleaning Supplies', amount: 1200.00, category: 'SUPPLIES', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), notes: 'Detergents and sanitizers', supplierIndex: 2 },
        { title: 'Gym Equipment Maintenance', amount: 2500.00, category: 'MAINTENANCE', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), notes: 'Treadmill repair', supplierIndex: 0 },
        { title: 'Internet Bill', amount: 1500.00, category: 'UTILITIES', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), notes: 'Fiber connection' }
    ];

    for (const e of expenses) {
        const { supplierIndex, ...expenseData } = e;
        const supplierId = supplierIndex !== undefined && dbSuppliers[supplierIndex] ? dbSuppliers[supplierIndex].id : null;

        const existing = await prisma.expense.findFirst({ where: { title: e.title } });

        if (!existing) {
            await prisma.expense.create({
                data: { ...expenseData, supplierId }
            });
        } else {
            await prisma.expense.update({
                where: { id: existing.id },
                data: { amount: expenseData.amount, supplierId }
            });
        }
    }
    console.log("✅ Expenses seeded (Budget adjusted)");

    console.log("🚀 Database successfully populated!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
