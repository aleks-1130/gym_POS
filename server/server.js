require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const prisma = require('./src/config/prisma');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorize } = require('./src/middleware/authMiddleware');
const logAudit = require('./src/services/auditService');
const { migrateInventoryDataToDatabase } = require('./src/features/inventory/inventoryDataMigrationService');
const { connectRedis } = require('./src/config/redisClient');

const cookieParser = require('cookie-parser');
const app = express();
const schedulingService = require('./src/services/schedulingService');
schedulingService.init();

const PORT = process.env.PORT || 5000;

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'https://gym-pos-coral.vercel.app',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [])
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie']
}));
const { globalLimiter } = require('./src/middleware/rateLimiter');

// Essential Security Headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images/resources to be loaded from other origins if needed
    contentSecurityPolicy: false, // Temporarily disabled if you have inline scripts or external CDNs in your frontend that break
}));

// Apply global rate limiting to all API routes
app.use('/api', globalLimiter);

app.use(express.json());
app.use(cookieParser());

// Serve static files (uploads) - ensure the folder exists or is handled
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/', (req, res) => {
    res.send('Gym POS API is running...');
});

app.get('/api/health', async (req, res) => {
    try {
        const userCount = await prisma.user.count();
        const productCount = await prisma.product.count();
        
        let redisStatus = 'disconnected';
        let redisHoldCount = 0;
        try {
            const { redisClient } = require('./src/config/redisClient');
            if (redisClient?.isOpen) {
                redisStatus = 'connected';
                const keys = await redisClient.keys('cart:reserve:*');
                redisHoldCount = keys.length;
            }
        } catch (re) {}

        res.json({ 
            status: 'ok', 
            db: 'connected', 
            userCount,
            productCount,
            redisStatus,
            redisHoldCount,
            timestamp: new Date().toISOString(), 
            env: process.env.NODE_ENV
        });
    } catch (e) {
        res.status(503).json({ 
            status: 'error', 
            db: 'disconnected', 
            message: e.message,
            timestamp: new Date().toISOString()
        });
    }
});

// --- HEALTH CHECK ---
app.get('/api/debug/env', (req, res) => {
    res.json({
        PORT: process.env.PORT,
        NODE_ENV: process.env.NODE_ENV,
        JWT_SECRET_PREFIX: process.env.JWT_SECRET ? process.env.JWT_SECRET.slice(0, 3) + '...' : 'MISSING',
        DB_URL_PREFIX: process.env.DATABASE_URL ? process.env.DATABASE_URL.slice(0, 20) + '...' : 'MISSING'
    });
});

// --- MODULE ROUTES ---
app.use('/api/auth', require('./src/features/auth/authRoutes'));
app.use('/api/dashboard', require('./src/features/dashboard/dashboardRoutes'));
app.use('/api/admin', require('./src/features/admin/adminRoutes'));
app.use('/api/staff', require('./src/features/admin/staffRoutes'));
// Member Routes (includes profile, generic booking)
app.use('/api/members', require('./src/features/members/memberRoutes'));
// Shop Routes (checkout, orders - mounted at /api/members for compatibility)
app.use('/api/members', require('./src/features/pos/shopRoutes'));
// Canonical shop routes to avoid /api/members/:id route collisions (e.g. /api/members/orders)
app.use('/api/shop', require('./src/features/pos/shopRoutes'));
app.use('/api/payments', require('./src/features/pos/paymentRoutes'));
app.use('/api/pos/reserve', require('./src/features/pos/reserveRoutes')); // Stock Reservation via Redis
app.use('/api/pos/promo-codes', require('./src/features/pos/promoRoutes'));
app.use('/api/pos', require('./src/features/pos/paymentRoutes')); // Alias for POS settings frontend
app.use('/api/access', require('./src/features/members/accessRoutes'));
app.use('/api/products', require('./src/features/inventory/productRoutes'));
app.use('/api/inventory', require('./src/features/inventory/inventoryRoutes'));
app.use('/api/inventory', require('./src/features/inventory/productRoutes')); // Alias for restock
app.use('/api/suppliers', require('./src/features/inventory/supplierRoutes'));
app.use('/api/trainers', require('./src/features/training/trainerRoutes'));
app.use('/api/trainer', require('./src/features/training/trainerRoutes')); // For /me routes
app.use('/api/training-sessions', require('./src/features/training/trainingSessionRoutes'));
app.use('/api/classes', require('./src/features/training/classRoutes'));
app.use('/api/loyalty', require('./src/features/pos/loyaltyRoutes'));
app.use('/api/expenses', require('./src/features/analytics/expenseRoutes'));
app.use('/api/notifications', require('./src/features/dashboard/notificationRoutes'));
app.use('/api/analytics', require('./src/features/analytics/analyticsRoutes'));
app.use('/api/seed', require('./src/features/admin/seedRoutes'));
app.use('/api/payment-methods', require('./src/features/members/paymentMethodRoutes'));
app.use('/api/settings', require('./src/features/settings/settingsRoutes'));
app.use('/api/plans', require('./src/features/pos/planRoutes'));
app.use('/api/owner/projection', require('./src/features/analytics/projectionRoutes'));

// --- INVENTORY / PRODUCT / SUPPLIER ROUTES ---
// Moved to src/routes/productRoutes.js and src/routes/supplierRoutes.js

// --- TRAINER / SESSION / CLASS ROUTES ---
// Moved to src/routes/trainerRoutes.js, src/routes/trainingSessionRoutes.js, src/routes/classRoutes.js

// --- LOYALTY / EXPENSE / NOTIFICATION / ANALYTICS / SEED ROUTES ---
// Moved to respective modules in src/routes

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n\n=== GYM POS SERVER STARTED ON PORT ${PORT} (0.0.0.0) ===\n\n`);
    try {
        await connectRedis(); // Boot up Redis for POS Cart Cart Holds
        const userCount = await prisma.user.count();
        if (userCount === 0) {
            console.log("Force Restart (Production Switch): " + new Date().toISOString());
            await prisma.user.create({
                data: {
                    email: process.env.INITIAL_ADMIN_EMAIL || 'admin@gym.com',
                    password: await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD || 'password123', 10),
                    name: 'Admin User',
                    role: 'ADMIN'
                }
            });
            console.log(`Database seeded! Admin: ${process.env.INITIAL_ADMIN_EMAIL || 'admin@gym.com'}`);
        }

        await migrateInventoryDataToDatabase();
    } catch (e) {
        const msg = (e && e.message) ? e.message : '';
        if (msg.includes("Can't reach database server")) {
            console.error("Seeding skipped: database is unreachable.");
            console.error("Check outbound access to Neon host/port 5432 and verify your Neon project is active.");
        } else {
            console.error("Seeding failed:", e);
        }
    }
});
