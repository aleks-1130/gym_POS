const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    console.log('Starting data backfill for gymId and tenantId...');

    const defaultGymId = 1;
    const defaultTenantId = 1;

    // Models to backfill
    const models = [
        'trainer',
        'class',
        'trainingSession',
        'booking',
        'payment',
        'expense',
        'payrollConfig',
        'receiptSettings'
    ];

    for (const model of models) {
        try {
            const count = await prisma[model].updateMany({
                where: {
                    OR: [
                        { gymId: null },
                        { tenantId: null }
                    ]
                },
                data: {
                    gymId: defaultGymId,
                    tenantId: defaultTenantId
                }
            });
            console.log(`Backfilled ${count.count} records for model: ${model}`);
        } catch (error) {
            console.error(`Failed to backfill model: ${model}`, error.message);
        }
    }

    // Special case for Product: only backfill if not global
    try {
        const productCount = await prisma.product.updateMany({
            where: {
                AND: [
                    { isGlobal: false },
                    { 
                        OR: [
                            { gymId: null },
                            { tenantId: null }
                        ]
                    }
                ]
            },
            data: {
                gymId: defaultGymId,
                tenantId: defaultTenantId
            }
        });
        console.log(`Backfilled ${productCount.count} records for model: product`);
    } catch (error) {
        console.error(`Failed to backfill model: product`, error.message);
    }

    console.log('Backfill complete.');
}

backfill()
    .catch((err) => console.error(err))
    .finally(() => prisma.$disconnect());
