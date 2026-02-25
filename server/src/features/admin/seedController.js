const prisma = require('../../config/prisma');

const seedDatabase = async (req, res) => {
    try {
        await prisma.paymentItem.deleteMany({});
        await prisma.orderItem.deleteMany({});
        await prisma.order.deleteMany({});
        await prisma.booking.deleteMany({});
        await prisma.sessionMaterial.deleteMany({});
        await prisma.trainingSession.deleteMany({});
        await prisma.accessLog.deleteMany({});
        await prisma.payment.deleteMany({});
        await prisma.memberNote.deleteMany({});
        await prisma.membershipPeriod.deleteMany({});
        await prisma.paymentMethod.deleteMany({});
        await prisma.member.deleteMany({});
        await prisma.class.deleteMany({});
        await prisma.plan.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.trainer.deleteMany({});
        await prisma.notification.deleteMany({});
        await prisma.loyaltyReward.deleteMany({});

        await prisma.plan.createMany({
            data: [
                { name: 'Annual Power', price: 9000, duration: 365 },
                { name: 'Half-Year Hustle', price: 5400, duration: 180 },
                { name: 'Quarter Crush', price: 3600, duration: 90 },
                { name: 'Monthly Fit', price: 2800, duration: 30 },
                { name: 'Drop-In', price: 100, duration: 1 }
            ]
        });

        await prisma.product.createMany({
            data: [
                { name: 'Whey Protein (Chocolate)', category: 'SUPPLEMENT', price: 2900, stock: 20, minStock: 5, imageUrl: '/products/whey_protein_chocolate.png' },
                { name: 'Pre-Workout (Fruit Punch)', category: 'SUPPLEMENT', price: 2500, stock: 15, minStock: 5, imageUrl: '/products/pre_workout_fruit.png' },
                { name: 'Energy Drink', category: 'DRINK', price: 65, stock: 100, minStock: 20, imageUrl: '/products/energy_drink.png' },
                { name: 'Protein Bar', category: 'SUPPLEMENT', price: 145, stock: 50, minStock: 10, imageUrl: '/products/protein_bar.png' },
                { name: 'Gym T-Shirt', category: 'MERCH', price: 500, stock: 30, minStock: 5, imageUrl: '/products/gym_tshirt.png' },
                { name: 'Lifting Straps', category: 'EQUIPMENT', price: 750, stock: 10, minStock: 2, imageUrl: '/products/lifting_straps.png' },
                { name: 'Energy Drink - Zero Sugar', category: 'DRINK', price: 200, stock: 50, minStock: 10, imageUrl: '/products/energy_drink_zero.png' },
                { name: 'Gym Shark Water Bottle', category: 'EQUIPMENT', price: 1450, stock: 15, minStock: 5, imageUrl: '/products/gym_shark_bottle.png' },
                { name: 'Pre-Workout - Blue Raz', category: 'SUPPLEMENT', price: 2030, stock: 20, minStock: 5, imageUrl: '/products/pre_workout_blue.png' }
            ]
        });

        const trainer1 = await prisma.trainer.create({
            data: { name: 'Alex Johnson', specialty: 'Bodybuilding', bio: 'IFBB Pro with 10 years experience.', imageUrl: 'https://images.unsplash.com/photo-1567013127542-490d75785b9c?auto=format&fit=crop&q=80&w=200' }
        });
        const trainer2 = await prisma.trainer.create({
            data: { name: 'Sarah Connor', specialty: 'CrossFit & HIIT', bio: 'High energy functional training expert.', imageUrl: 'https://images.unsplash.com/photo-1611672585731-fa10603fb9e0?auto=format&fit=crop&q=80&w=200' }
        });
        const trainer3 = await prisma.trainer.create({
            data: { name: 'Mike Tyson (Coach)', specialty: 'Boxing', bio: 'Legendary boxing fundamentals.', imageUrl: 'https://images.unsplash.com/photo-1549476464-37392f717541?auto=format&fit=crop&q=80&w=200' }
        });

        await prisma.class.createMany({
            data: [
                { name: 'Morning HIIT', trainerId: trainer2.id, dayOfWeek: 'Monday', time: '07:00 AM', duration: 45, capacity: 20 },
                { name: 'Power Hour', trainerId: trainer1.id, dayOfWeek: 'Monday', time: '06:00 PM', duration: 60, capacity: 15 },
                { name: 'Boxing Basics', trainerId: trainer3.id, dayOfWeek: 'Tuesday', time: '05:00 PM', duration: 60, capacity: 10 },
                { name: 'Yoga Flow', trainerId: trainer2.id, dayOfWeek: 'Wednesday', time: '08:00 AM', duration: 60, capacity: 25 },
                { name: 'Leg Day Blast', trainerId: trainer1.id, dayOfWeek: 'Thursday', time: '06:00 PM', duration: 90, capacity: 15 },
                { name: 'Weekend Warriors', trainerId: trainer2.id, dayOfWeek: 'Saturday', time: '10:00 AM', duration: 60, capacity: 30 }
            ]
        });

        await prisma.notification.createMany({
            data: [
                { title: 'System Maintenance', message: 'The system will be offline for maintenance on Sunday at 2 AM.', type: 'ALERT', date: new Date() },
                { title: 'New Supplement Shipment', message: 'Restocked Gold Standard Whey and Pre-workout.', type: 'INFO', date: new Date(Date.now() - 86400000) },
                { title: 'Holiday Hours', message: 'We will close early on July 4th at 4 PM.', type: 'INFO', date: new Date(Date.now() - 172800000) },
                { title: 'Promo: Refer a Friend', message: 'Get 1 month free when you refer a friend!', type: 'PROMO', date: new Date(Date.now() - 259200000) }
            ]
        });

        const plan = await prisma.plan.findFirst();
        await prisma.member.createMany({
            data: [
                { firstName: 'Bruce', lastName: 'Wayne', email: 'bruce@wayne.com', status: 'ACTIVE', planId: plan.id, points: 500, startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                { firstName: 'Clark', lastName: 'Kent', email: 'clark@dailyplanet.com', status: 'ACTIVE', planId: plan.id, points: 120, startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                { firstName: 'Diana', lastName: 'Prince', email: 'diana@amazon.com', status: 'ACTIVE', planId: plan.id, points: 350, startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                { firstName: 'Barry', lastName: 'Allen', email: 'barry@flash.com', status: 'EXPIRED', planId: plan.id, points: 0, startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }
            ]
        });

        await prisma.loyaltyReward.createMany({
            data: [
                { name: 'Free Smoothie', cost: 100, description: 'One free protein smoothie' },
                { name: 'Towel Service', cost: 50, description: 'Free towel rental for one month' },
                { name: 'Free Day Pass', cost: 200, description: 'Bring a friend for free' },
                { name: 'Personal Training Session', cost: 500, description: 'One hour with a certified trainer' },
                { name: 'Gym T-Shirt', cost: 300, description: 'Official gym merchandise' }
            ]
        });

        res.json({ message: "Comprehensive dummy data seeded!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

module.exports = {
    seedDatabase
};
