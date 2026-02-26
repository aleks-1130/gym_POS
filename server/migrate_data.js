const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const dbPath = path.join(__dirname, 'prisma', 'dev.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) console.error("Error opening SQLite DB:", err.message);
    else console.log("Connected to SQLite database.");
});

const readTable = (tableName) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const transform = (row, booleanKeys = [], dateKeys = []) => {
    const newRow = { ...row };
    // Convert booleans (0/1 to false/true)
    booleanKeys.forEach(key => {
        if (newRow[key] !== undefined && newRow[key] !== null) {
            newRow[key] = !!newRow[key];
        }
    });
    // Convert dates (proactively try to convert common date fields)
    const knownDateKeys = ['createdAt', 'updatedAt', 'date', 'startDate', 'endDate', 'expiryDate', 'checkIn', 'birthDate', 'paidAt', 'timestamp', 'freezeStartDate', 'freezeEndDate', 'externalDate'];
    // Merge with specific keys
    const allDateKeys = [...new Set([...knownDateKeys, ...dateKeys])];

    allDateKeys.forEach(key => {
        if (newRow[key]) {
            // Check if it's a number (timestamp) or string
            const val = newRow[key];
            if (typeof val === 'number') {
                newRow[key] = new Date(val);
            } else if (typeof val === 'string') {
                newRow[key] = new Date(val);
            }
        }
    });

    return newRow;
};

const migrate = async () => {
    try {
        console.log("Resuming migration for dependents...");

        // SKIP CLEANUP to preserve Members
        /*
        console.log("Cleaning up existing data in Neon...");
        await prisma.expense.deleteMany();
        await prisma.paymentItem.deleteMany();
        await prisma.payment.deleteMany();
        await prisma.orderItem.deleteMany();
        await prisma.order.deleteMany();
        await prisma.sessionMaterial.deleteMany();
        await prisma.trainingSession.deleteMany();
        await prisma.memberNote.deleteMany();
        await prisma.accessLog.deleteMany();
        await prisma.paymentMethod.deleteMany();
        await prisma.booking.deleteMany();
        await prisma.class.deleteMany();
        await prisma.membershipPeriod.deleteMany(); // depends on Member and Plan
        await prisma.member.deleteMany();
        await prisma.user.deleteMany(); // Users might depend on Trainer
        await prisma.trainer.deleteMany();
        await prisma.auditLog.deleteMany();
        await prisma.notification.deleteMany();
        await prisma.loyaltyReward.deleteMany();
        await prisma.posConfig.deleteMany();
        await prisma.product.deleteMany(); // depends on Supplier
        await prisma.supplier.deleteMany();
        await prisma.plan.deleteMany();
        console.log("Cleanup complete.");
        */

        // MIGRATION HELPER
        const migrateTable = async (tableName, prismaModel, transformFn = transform) => {
            try {
                // Check if already exists to be safe? No, assume we know state.
                console.log(`Migrating ${tableName}...`);
                const rows = await readTable(tableName);
                if (rows.length > 0) {
                    await prismaModel.createMany({ data: rows.map(r => transformFn(r)) });
                    console.log(`✅ ${tableName}: ${rows.length} records migrated.`);
                } else {
                    console.log(`⚠️ ${tableName}: No records found.`);
                }
            } catch (error) {
                console.error(`❌ Failed to migrate ${tableName}:`, error.message);
                // detailed error might help
                if (error.code) console.error(`   Code: ${error.code}`);
                if (error.meta) console.error(`   Meta:`, error.meta);
            }
        };

        // SKIP ALREADY MIGRATED
        /*
        // 1. Independent Tables
        await migrateTable('Plan', prisma.plan);
        await migrateTable('Supplier', prisma.supplier);
        await migrateTable('PosConfig', prisma.posConfig);
        await migrateTable('LoyaltyReward', prisma.loyaltyReward);
        await migrateTable('Notification', prisma.notification, (r) => transform(r, ['read']));
        await migrateTable('AuditLog', prisma.auditLog);

        // 2. Products (Depends on Supplier)
        await migrateTable('Product', prisma.product);

        // 3. Trainers (Independent)
        await migrateTable('Trainer', prisma.trainer);

        // 4. Users (Depend on Trainer)
        // Note: Users in SQLite might have mixed data. 
        // We'll migrate them. Use transform to handle potential nulls if needed.
        await migrateTable('User', prisma.user);

        // 5. Members (Depend on Plan)
        await migrateTable('Member', prisma.member);
        */

        // 6. Dependents (Resume from here)
        await migrateTable('Class', prisma.class);
        await migrateTable('Booking', prisma.booking); // Depend on Member, Class
        await migrateTable('PaymentMethod', prisma.paymentMethod, (r) => transform(r, ['isDefault']));
        await migrateTable('AccessLog', prisma.accessLog);
        await migrateTable('MemberNote', prisma.memberNote);
        await migrateTable('TrainingSession', prisma.trainingSession, (r) => transform(r, ['commissionPaid']));
        await migrateTable('SessionMaterial', prisma.sessionMaterial);

        // Orders requires careful handling of table name because "Order" is reserved in some SQL, 
        // but Prisma handles it. In SQLite it might be "Order" or "Orders" depending on create script.
        // check_sqlite said "Order": syntax error near "Order" which suggests we might need to quote it in readTable

        // Fix readTable for Order by quoting the table name if it is 'Order'
        // But readTable uses string interpolation.

        try {
            console.log(`Migrating Order...`);
            // Custom read for Order to quote table name
            const orders = await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM "Order"`, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            if (orders.length > 0) {
                await prisma.order.createMany({ data: orders.map(r => transform(r)) });
                console.log(`✅ Order: ${orders.length} records migrated.`);
            }
        } catch (e) {
            console.error(`❌ Failed to migrate Order:`, e.message);
        }

        await migrateTable('OrderItem', prisma.orderItem);
        await migrateTable('Payment', prisma.payment);
        await migrateTable('PaymentItem', prisma.paymentItem);
        await migrateTable('Expense', prisma.expense, (r) => transform(r, ['recurring']));
        await migrateTable('MembershipPeriod', prisma.membershipPeriod);

        console.log("✅ Dependent migration finished.");

    } catch (e) {
        console.error("❌ Critical Migration Error:", e);
    } finally {
        await prisma.$disconnect();
        db.close();
    }
};

migrate();
