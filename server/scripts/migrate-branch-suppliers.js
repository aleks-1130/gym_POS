const prisma = require('../src/config/prisma');

async function migrateSuppliers() {
    console.log("--- Starting Branch-Specific Supplier Migration ---");
    
    // 1. Get all products
    const products = await prisma.product.findMany({
        include: {
            stocks: true
        }
    });
    
    console.log(`Found ${products.length} products to migrate.`);
    
    // 2. Get all gyms to handle global product distribution
    const gyms = await prisma.gym.findMany();
    const gymIds = gyms.map(g => g.id);
    
    let updatedStocks = 0;
    
    for (const product of products) {
        const { id: productId, supplierId, supplyCost, gymId: productGymId } = product;
        
        // Skip if no supplier/cost to migrate (though supplyCost defaults to 0)
        if (!supplierId && supplyCost === 0) continue;
        
        if (productGymId) {
            // Local Product: Migration to its own branch stock
            await prisma.productStock.upsert({
                where: {
                    productId_gymId: {
                        productId,
                        gymId: productGymId
                    }
                },
                update: {
                    supplierId,
                    supplyCost
                },
                create: {
                    productId,
                    gymId: productGymId,
                    supplierId,
                    supplyCost,
                    quantity: product.stock, // Fallback to current product stock
                    minQuantity: product.minStock
                }
            });
            updatedStocks++;
        } else {
            // Global Product: Migrate to ALL branch stocks initially
            // The user said: "once i check branch 2, it should reflect as 'no supplier assigned' first"
            // Wait, if I migrate it to ALL, then branch 2 gets the same supplier.
            // BUT, if the product was already global, maybe it only had a supplier in the branch it was "set" in.
            // Actually, the safest migration is to only set it for the branch that "owned" it if we knew.
            // But for global products, we don't know who "owns" it.
            
            // To match user's request: "if i'll set an existing product from the main branch as global, their supplier in that main branch shouldnt change."
            // This implies existing global products might want to KEEP their supplier in some branches, but not others.
            
            // For existing data, we'll just migrate to whatever stocks exist.
            // If the user wants Branch 2 to be empty, they can clear it later, 
            // OR we only migrate if the stock record exists.
            
            for (const stock of product.stocks) {
               await prisma.productStock.update({
                   where: { id: stock.id },
                   data: {
                       supplierId,
                       supplyCost
                   }
               });
               updatedStocks++;
            }
        }
    }
    
    console.log(`Migration complete. Updated/Created ${updatedStocks} stock records.`);
}

migrateSuppliers()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
