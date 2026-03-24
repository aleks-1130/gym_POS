require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { syncToNeonAuth } = require('./src/services/neonAuthSync');
const prisma = new PrismaClient();

async function promote(email) {
    if (!email) {
        console.error('Please provide an email: node promote_superadmin.js <email>');
        process.exit(1);
    }

    const password = 'password123';

    try {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                role: 'SUPERADMIN',
                tenantId: null
            },
            create: {
                email,
                name: 'Super Admin',
                password: hashedPassword,
                role: 'SUPERADMIN'
            }
        });

        console.log(`\n[1/2] SUCCESS: Local database updated for ${email}.`);
        
        console.log(`[2/2] Syncing ${email} to Neon Auth...`);
        const syncSuccess = await syncToNeonAuth('Super Admin', email, password, true);

        if (syncSuccess) {
            console.log(`\n✨ ALL DONE! User ${email} is now a SUPERADMIN and synced with Neon Auth.`);
            console.log(`Email: ${email}`);
            console.log(`Password: ${password}`);
        } else {
            console.log(`\n⚠️ Local database updated, but Neon Auth sync failed.`);
            console.log(`Please ensure NEON_AUTH_URL is set in your .env file.`);
        }
        
        console.log('\nPlease log in with these credentials to access the Superadmin dashboard.\n');
    } catch (error) {
        console.error('\nERROR:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

const email = process.argv[2];
promote(email);
