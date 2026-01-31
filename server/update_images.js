const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🖼 Updating product images...");

    const updates = [
        { name: 'Whey Protein (Chocolate)', url: '/products/whey_protein_chocolate.png' },
        { name: 'Pre-Workout (Fruit Punch)', url: '/products/pre_workout_fruit.png' },
        { name: 'Energy Drink', url: '/products/energy_drink.png' },
        { name: 'Protein Bar', url: '/products/protein_bar.png' },
        { name: 'Gym T-Shirt', url: '/products/gym_tshirt.png' },
        { name: 'Lifting Straps', url: '/products/lifting_straps.png' },
        { name: 'Energy Drink - Zero Sugar', url: '/products/energy_drink_zero.png' },
        { name: 'Gym Shark Water Bottle', url: '/products/gym_shark_bottle.png' },
        { name: 'Pre-Workout - Blue Raz', url: '/products/pre_workout_blue.png' }
    ];

    for (const update of updates) {
        try {
            const product = await prisma.product.findFirst({ where: { name: update.name } });
            if (product) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { imageUrl: update.url }
                });
                console.log(`✅ Updated image for: ${update.name}`);
            } else {
                console.log(`⚠️ Product not found: ${update.name}`);
            }
        } catch (e) {
            console.error(`❌ Failed to update ${update.name}: ${e.message}`);
        }
    }
    console.log("✨ Image update complete!");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
