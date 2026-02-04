const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🔄 Starting Product Cost & Supplier Population...");

    // 1. Ensure we have suppliers
    let suppliers = await prisma.supplier.findMany();
    if (suppliers.length === 0) {
        console.log("⚠️ No suppliers found. Creating defaults...");
        await prisma.supplier.createMany({
            data: [
                { name: "Gym Essentials Co.", contact: "0917-111-2222", email: "sales@gymessentials.com", address: "Makati City" },
                { name: "Supplement Hub", contact: "0918-333-4444", email: "orders@supphub.ph", address: "Taguig City" },
                { name: "FitGear Manila", contact: "0919-555-6666", email: "support@fitgear.ph", address: "Pasig City" }
            ]
        });
        suppliers = await prisma.supplier.findMany();
    }
    console.log(`✅ Available Suppliers: ${suppliers.length}`);

    // 2. Get all products
    const products = await prisma.product.findMany();
    console.log(`📦 Found ${products.length} products to update.`);

    // 3. Update each product
    for (const product of products) {
        // Assign a random supplier
        const randomSupplier = suppliers[Math.floor(Math.random() * suppliers.length)];

        // Calculate Supply Cost (e.g., 60% of selling price, or default 100 if price is 0)
        let cost = product.price * 0.6;
        if (cost === 0) cost = 50; // Fallback for free items

        // Round to 2 decimal places
        cost = Math.round(cost * 100) / 100;

        await prisma.product.update({
            where: { id: product.id },
            data: {
                supplierId: randomSupplier.id,
                supplyCost: cost
            }
        });

        console.log(`   Updated ${product.name}: Supplier=${randomSupplier.name}, Cost=${cost}`);
    }

    console.log("✅ Population Complete!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
