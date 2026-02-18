require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const prisma = require('./src/config/prisma');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorize } = require('./src/middleware/authMiddleware');
const logAudit = require('./src/services/auditService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files (uploads) - ensure the folder exists or is handled
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/', (req, res) => {
    res.send('Gym POS API is running...');
});

// --- MODULE ROUTES ---
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/staff', require('./src/routes/staffRoutes'));
// Member Routes (includes profile, generic booking)
app.use('/api/members', require('./src/routes/memberRoutes'));
// Shop Routes (checkout, orders - mounted at /api/members for compatibility)
app.use('/api/members', require('./src/routes/shopRoutes'));
app.use('/api/payments', require('./src/routes/paymentRoutes'));
app.use('/api/access', require('./src/routes/accessRoutes'));
app.use('/api/products', require('./src/routes/productRoutes'));
app.use('/api/inventory', require('./src/routes/productRoutes')); // Alias for restock
app.use('/api/suppliers', require('./src/routes/supplierRoutes'));
app.use('/api/trainers', require('./src/routes/trainerRoutes'));
app.use('/api/trainer', require('./src/routes/trainerRoutes')); // For /me routes
app.use('/api/training-sessions', require('./src/routes/trainingSessionRoutes'));
app.use('/api/classes', require('./src/routes/classRoutes'));
app.use('/api/loyalty', require('./src/routes/loyaltyRoutes'));
app.use('/api/expenses', require('./src/routes/expenseRoutes'));
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/analytics', require('./src/routes/analyticsRoutes'));
app.use('/api/seed', require('./src/routes/seedRoutes'));
app.use('/api/payment-methods', require('./src/routes/paymentMethodRoutes'));
app.use('/api/settings', require('./src/routes/settingsRoutes'));
app.use('/api/plans', require('./src/routes/planRoutes'));

// --- INVENTORY / PRODUCT / SUPPLIER ROUTES ---
// Moved to src/routes/productRoutes.js and src/routes/supplierRoutes.js

// --- TRAINER / SESSION / CLASS ROUTES ---
// Moved to src/routes/trainerRoutes.js, src/routes/trainingSessionRoutes.js, src/routes/classRoutes.js

// --- LOYALTY / EXPENSE / NOTIFICATION / ANALYTICS / SEED ROUTES ---
// Moved to respective modules in src/routes

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n\n=== GYM POS SERVER STARTED ON PORT ${PORT} (0.0.0.0) ===\n\n`);
    try {
        const userCount = await prisma.user.count();
        if (userCount === 0) {
            console.log("Force Restart (Production Switch): " + new Date().toISOString());
            await prisma.user.create({
                data: {
                    email: 'admin@gym.com',
                    password: await bcrypt.hash('password123', 10),
                    name: 'Admin User',
                    role: 'ADMIN'
                }
            });
            console.log("Database seeded! Admin: admin@gym.com / password123");
        }
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
