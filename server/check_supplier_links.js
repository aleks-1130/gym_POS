const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Supplier-Product Links...");

    const suppliers = await prisma.supplier.findMany({
        include: { _count: { select: { products: true } } }
    });

    console.log(`Found ${suppliers.length} suppliers.`);
    suppliers.forEach(s => {
        console.log(`- ${s.name}: ${s._count.products} linked products`);
    });

    const productsWithSupplier = await prisma.product.count({
        where: { supplierId: { not: null } }
    });
    console.log(`\nTotal Products with Supplier ID: ${productsWithSupplier}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
