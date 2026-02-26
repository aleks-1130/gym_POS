const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting Database Seeding...");

    // 1. CLEAR EXISTING DATA (Optional, but good for clean slate if needed. Commented out to be safe, or just use upsert)
    // 1. CLEAR EXISTING DATA 
    // START FRESH to remove bad test data
    try {
        await prisma.paymentItem.deleteMany(); // Delete items first
        await prisma.payment.deleteMany();
        await prisma.accessLog.deleteMany();
        // await prisma.member.deleteMany(); // Keep members if you want, or wipe them too? 
        // Let's wipe seeded members to avoid duplicates if loop logic isn't perfect
        // But the script checks checks checks. 
        // For now, wiping Payments is crucial.
    } catch (e) {
        console.log("Cleanup warning:", e.message);
    }
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

    // 2. SEED PLANS
    const plans = [
        { name: 'Annual Power', price: 9000, duration: 365 },
        { name: 'Half-Year Hustle', price: 5400, duration: 180 },
        { name: 'Quarter Crush', price: 3600, duration: 90 },
        { name: 'Monthly Fit', price: 2800, duration: 30 },
        { name: 'Drop-In', price: 100, duration: 1 }
    ];

    for (const p of plans) {
        // await prisma.plan.create({ data: p });
        const existing = await prisma.plan.findFirst({ where: { name: p.name } });
        if (!existing) {
            await prisma.plan.create({ data: p });
            // console.log(`Created ${p.name}`);
        } else {
            // console.log(`Skipped ${p.name} (Exists)`);
        }
    }
    console.log("✅ Plans seeded");

    // 3. SEED PRODUCTS
    const products = [
        { name: 'Whey Protein (Chocolate)', category: 'SUPPLEMENT', price: 2900, stock: 20, minStock: 5, imageUrl: '/products/whey_protein_chocolate.png' },
        { name: 'Pre-Workout (Fruit Punch)', category: 'SUPPLEMENT', price: 2500, stock: 15, minStock: 5, imageUrl: '/products/pre_workout_fruit.png' },
        { name: 'Energy Drink', category: 'DRINK', price: 65, stock: 100, minStock: 20, imageUrl: '/products/energy_drink.png' },
        { name: 'Protein Bar', category: 'SUPPLEMENT', price: 145, stock: 50, minStock: 10, imageUrl: '/products/protein_bar.png' },
        { name: 'Gym T-Shirt', category: 'MERCH', price: 500, stock: 30, minStock: 5, imageUrl: '/products/gym_tshirt.png' },
        { name: 'Lifting Straps', category: 'EQUIPMENT', price: 750, stock: 10, minStock: 2, imageUrl: '/products/lifting_straps.png' },
        { name: 'Energy Drink - Zero Sugar', category: 'DRINK', price: 200, stock: 50, minStock: 10, imageUrl: '/products/energy_drink_zero.png' },
        { name: 'Gym Shark Water Bottle', category: 'EQUIPMENT', price: 1450, stock: 15, minStock: 5, imageUrl: '/products/gym_shark_bottle.png' },
        { name: 'Pre-Workout - Blue Raz', category: 'SUPPLEMENT', price: 2030, stock: 20, minStock: 5, imageUrl: '/products/pre_workout_blue.png' }
    ];

    for (const p of products) {
        // Check existence or upsert (Product doesn't have unique name by schema, but we want it unique logically)
        // Since schema doesn't force unique name, upsert needs a unique field. name isn't unique in schema.
        // So we use findFirst -> then create if not found.
        const existing = await prisma.product.findFirst({ where: { name: p.name } });
        if (!existing) {
            await prisma.product.create({ data: p });
            // console.log(`Created ${p.name}`);
        } else {
            // Update prices if changed
            await prisma.product.update({
                where: { id: existing.id },
                data: { price: p.price }
            });
            console.log(`Updated Price for ${p.name}`);
        }
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
        // Assign random plan, but Annual Power for John Doe
        let plan;
        if (m.email === 'john@doe.com') {
            plan = await prisma.plan.findFirst({ where: { name: 'Annual Power' } });
            if (!plan) plan = await prisma.plan.findFirst();
        } else {
            plan = await prisma.plan.findFirst();
        }

        const member = await prisma.member.upsert({
            where: { email: m.email },
            update: {
                points: m.points,
                status: m.status,
                planId: plan.id
            },
            create: {
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
        // Create 3-5 random payments for each
        const count = Math.floor(Math.random() * 3) + 1;
        const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });

        for (let i = 0; i < count; i++) {
            const amount = (Math.random() * 500) + 100; // 100-600 PHP
            const payment = await prisma.payment.create({
                data: {
                    amount: Math.floor(amount),
                    type: 'POS_SALE',
                    method: ['CASH', 'CARD', 'GCASH'][Math.floor(Math.random() * 3)],
                    memberId: member.id,
                    cashierId: owner ? owner.id : null,
                    date: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
                }
            });

            // Add Items
            await prisma.paymentItem.create({
                data: {
                    paymentId: payment.id,
                    productId: products[0].id, // Just pick first product for demo
                    name: products[0].name,
                    type: 'PRODUCT',
                    quantity: 1,
                    unitPrice: products[0].price
                }
            });
        }
    }
    console.log("✅ Payments seeded");

    // 6. SEED ACCESS LOGS
    for (const member of dbMembers) {
        if (member.email === 'john@doe.com') {
            await prisma.accessLog.createMany({
                data: [
                    { memberId: member.id, checkIn: new Date(new Date().setDate(new Date().getDate() - 5)), status: 'ALLOWED' },
                    { memberId: member.id, checkIn: new Date(new Date().setDate(new Date().getDate() - 3)), status: 'ALLOWED' },
                    { memberId: member.id, checkIn: new Date(), status: 'ALLOWED' }
                ]
            });
        } else {
            await prisma.accessLog.create({
                data: {
                    memberId: member.id,
                    status: 'ALLOWED',
                    checkIn: new Date()
                }
            });
        }
    }
    console.log("✅ Access Logs seeded");

    // 7. SEED TRAINERS
    const trainers = [
        {
            name: 'Arnold S.',
            specialization: 'Bodybuilding Coach',
            specialty: 'Bodybuilding',
            bio: 'Former Mr. Olympia with 20+ years of coaching experience. Specializes in strength training and muscle building.',
            experience: 20,
            rating: 4.9,
            sessionPrice: 4200.00,
            availableSlots: 3,
            specialties: 'Strength Training,Muscle Building,Bodybuilding,Nutrition',
            imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop'
        },
        {
            name: 'Ronda R.',
            specialization: 'Combat Sports Trainer',
            specialty: 'MMA / Boxing',
            bio: 'Champion fighter with expertise in MMA, boxing, and self-defense. Great for conditioning.',
            experience: 15,
            rating: 4.8,
            sessionPrice: 4500.00,
            availableSlots: 2,
            specialties: 'MMA,Boxing,Self-Defense,Cardio,Agility',
            imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop'
        },
        {
            name: 'James Wilson',
            specialization: 'Fitness Coach',
            specialty: 'General Fitness',
            bio: 'Certified personal trainer specializing in weight loss and general fitness. Known for personalized programs.',
            experience: 8,
            rating: 4.7,
            sessionPrice: 3400.00,
            availableSlots: 5,
            specialties: 'Weight Loss,HIIT,General Fitness,Flexibility',
            imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'
        },
        {
            name: 'Sarah Chen',
            specialization: 'Yoga & Flexibility',
            specialty: 'Yoga & Flexibility',
            bio: 'Certified yoga instructor and flexibility specialist. Perfect for recovery and mindfulness.',
            experience: 10,
            rating: 4.9,
            sessionPrice: 3100.00,
            availableSlots: 4,
            specialties: 'Yoga,Pilates,Flexibility,Mobility,Mindfulness',
            imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop'
        },
        {
            name: 'Marcus Johnson',
            specialization: 'CrossFit Coach',
            specialty: 'CrossFit',
            bio: 'Level 2 CrossFit coach with competition experience. Specializes in functional fitness and Olympic lifting.',
            experience: 12,
            rating: 4.8,
            sessionPrice: 3900.00,
            availableSlots: 2,
            specialties: 'CrossFit,Olympic Lifting,Functional Fitness,Power Training',
            imageUrl: 'https://images.unsplash.com/photo-1500595046891-32b56a8e7eb9?w=400&h=400&fit=crop'
        },
        {
            name: 'Emily Davis',
            specialization: 'Nutrition & Wellness',
            specialty: 'Nutrition Coaching',
            bio: 'Certified nutrition specialist combining diet coaching with fitness training for holistic results.',
            experience: 7,
            rating: 4.6,
            sessionPrice: 2800.00,
            availableSlots: 6,
            specialties: 'Nutrition,Wellness,Weight Management,Lifestyle Coaching',
            imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop'
        }
    ];

    const dbTrainers = [];
    for (const t of trainers) {
        const trainer = await prisma.trainer.create({ data: t });
        dbTrainers.push(trainer);
    }
    console.log("✅ Trainers seeded");

    // 8. SEED TRAINING SESSIONS
    for (const member of dbMembers) {
        // Create 2-4 training sessions for each member
        const sessionCount = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < sessionCount; i++) {
            const randomTrainer = dbTrainers[Math.floor(Math.random() * dbTrainers.length)];
            const daysAgo = Math.floor(Math.random() * 30);
            const sessionDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

            await prisma.trainingSession.create({
                data: {
                    memberId: member.id,
                    trainerId: randomTrainer.id,
                    date: sessionDate,
                    duration: [30, 60, 90, 120][Math.floor(Math.random() * 4)],
                    price: randomTrainer.sessionPrice,
                    status: daysAgo > 3 ? 'COMPLETED' : 'SCHEDULED',
                    notes: ['Great progress!', 'Focus on form', 'Push harder next time', 'Perfect execution!'][Math.floor(Math.random() * 4)]
                }
            });
        }
    }
    console.log("✅ Training Sessions seeded");

    // 9. SEED LOYALTY REWARDS
    const rewards = [
        {
            name: 'Premium Gym Towel',
            cost: 250,
            category: 'MERCHANDISE',
            description: 'Luxurious microfiber gym towel',
            imageUrl: 'https://images.unsplash.com/photo-1595777707802-c2d353eadc00?w=400&h=400&fit=crop'
        },
        {
            name: 'Shaker Bottle Pack',
            cost: 300,
            category: 'MERCHANDISE',
            description: 'Pack of 3 premium shaker bottles',
            imageUrl: 'https://images.unsplash.com/photo-1608270861620-7c80fc2d865c?w=400&h=400&fit=crop'
        },
        {
            name: 'Protein Powder (2kg)',
            cost: 500,
            category: 'SUPPLEMENT',
            description: 'High-quality whey protein powder',
            imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop'
        },
        {
            name: 'BCAA Supplement',
            cost: 350,
            category: 'SUPPLEMENT',
            description: 'Essential amino acids for recovery',
            imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=400&fit=crop'
        },
        {
            name: 'Gym T-Shirt',
            cost: 400,
            category: 'APPAREL',
            description: 'Official gym branded t-shirt',
            imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop'
        },
        {
            name: 'Athletic Shorts',
            cost: 450,
            category: 'APPAREL',
            description: 'Breathable athletic shorts',
            imageUrl: 'https://images.unsplash.com/photo-1506629082632-401ba14f4ef9?w=400&h=400&fit=crop'
        },
        {
            name: 'Resistance Bands Set',
            cost: 380,
            category: 'MERCHANDISE',
            description: '5-piece resistance band set',
            imageUrl: 'https://images.unsplash.com/photo-1590308882746-84bedd5eb6a8?w=400&h=400&fit=crop'
        },
        {
            name: '1 Month Free Membership',
            cost: 800,
            category: 'EXPERIENCE',
            description: 'One month of unlimited gym access',
            imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop'
        },
        {
            name: 'Free Training Session',
            cost: 600,
            category: 'EXPERIENCE',
            description: '1-on-1 training session with a professional',
            imageUrl: 'https://images.unsplash.com/photo-1583454110118-cc83b9b80313?w=400&h=400&fit=crop'
        },
        {
            name: 'Water Bottle (750ml)',
            cost: 200,
            category: 'MERCHANDISE',
            description: 'Stainless steel insulated water bottle',
            imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop'
        }
    ];

    for (const reward of rewards) {
        await prisma.loyaltyReward.create({ data: reward });
    }
    console.log("✅ Loyalty Rewards seeded");

    // 10. SEED SUPPLIERS
    const suppliers = [
        { name: 'Gym Pro Supplies', contact: 'John Sales', email: 'sales@gympro.com', address: '123 Warehouse Dr', notes: 'Main equipment supplier' },
        { name: 'NutriWhole Wholesale', contact: 'Alice Nutrition', email: 'alice@nutriwhole.com', address: '456 Wellness Blvd', notes: 'Supplements' },
        { name: 'CleanTech Solutions', contact: 'Bob Cleaner', email: 'bob@cleantech.com', address: '789 San Ildefonso', notes: 'Cleaning supplies' }
    ];

    for (const s of suppliers) {
        // Upsert assumes a unique field, but name isn't unique in schema.
        // So we verify existence first.
        const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
        if (!existing) {
            await prisma.supplier.create({ data: s });
        }
    }
    console.log("✅ Suppliers seeded");

    // 11. SEED EXPENSES
    const expenses = [
        { title: 'Electricity Bill', amount: 15000.00, category: 'UTILITIES', date: new Date(), notes: 'Current Bill' },
        { title: 'Water Bill', amount: 3000.00, category: 'UTILITIES', date: new Date(), notes: 'Current Bill' },
        { title: 'Staff Salary', amount: 45000.00, category: 'SALARY', date: new Date(), notes: 'Monthly Payroll' },
        { title: 'Cleaning Supplies', amount: 2500.00, category: 'SUPPLIES', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), notes: 'Detergents and sanitizers' },
        { title: 'Gym Equipment Maintenance', amount: 5000.00, category: 'MAINTENANCE', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), notes: 'Treadmill repair' },
        { title: 'Internet Bill', amount: 2000.00, category: 'UTILITIES', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), notes: 'Fiber connection' }
    ];

    for (const e of expenses) {
        // Check for duplicates based on title and amount (date is approximate in check)
        // Since we use dynamic dates for seed, we'll check title/amount.
        const existing = await prisma.expense.findFirst({
            where: {
                title: e.title,
                amount: e.amount
            }
        });

        if (!existing) {
            await prisma.expense.create({ data: e });
        }
    }
    console.log("✅ Expenses seeded");

    console.log("🚀 Database successfully populated!");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
