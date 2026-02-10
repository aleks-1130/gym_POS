require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET;
const POS_PIN_MIN_LENGTH = 4;

app.use(cors());
app.use(express.json());

// Middleware to verify Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authenticateTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, SECRET, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};

// Middleware for Role Checking
// Middleware for Role Checking (Strict)
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    // "OWNER" implies all access, so if roles=['ADMIN'], Owner should also pass?
    // Actually, let's keep it strict. If a route is ['ADMIN'], Owner should be explicitly added if allowed.
    // However, usually Owner > Admin > Staff. 
    // Hierarchy: OWNER > ADMIN > STAFF

    return (req, res, next) => {
        if (!req.user) return res.sendStatus(401);

        const userRole = req.user.role; // OWNER, ADMIN, STAFF

        if (roles.includes("OWNER") && userRole === "OWNER") return next();
        if (roles.includes("ADMIN") && (userRole === "ADMIN" || userRole === "OWNER")) return next();
        if (roles.includes("STAFF") && (userRole === "STAFF" || userRole === "ADMIN" || userRole === "OWNER")) return next();

        // Exact match fallback (if logic above misses)
        if (roles.includes(userRole)) return next();

        return res.status(403).json({ error: "Access denied" });
    };
};

const logAudit = async (action, performedBy, target, details) => {
    try {
        await prisma.auditLog.create({
            data: { action, performedBy, target, details }
        });
    } catch (e) {
        console.error("Audit Log Error:", e);
    }
};

const getPosConfig = async () => {
    let config = await prisma.posConfig.findFirst();
    if (!config) {
        config = await prisma.posConfig.create({ data: {} });
    }
    return config;
};

const adjustMemberPoints = async (memberId, delta) => {
    if (!memberId || !delta) return;
    const member = await prisma.member.findUnique({ where: { id: Number(memberId) } });
    if (!member) return;
    const nextPoints = Math.max(0, (member.points || 0) + Number(delta));
    await prisma.member.update({
        where: { id: Number(memberId) },
        data: { points: nextPoints }
    });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    // Only for Staff/Admin registration for now
    const { email, password, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name }
        });
        res.json({ message: "User created" });
    } catch (e) {
        res.status(400).json({ error: "Email usage already exists or error" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // 1. Try finding in USER table (Owner/Admin/Staff/Trainer)
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            if (await bcrypt.compare(password, user.password)) {
                // Ensure role is sent
                const token = jwt.sign({ id: user.id, role: user.role, type: 'USER', trainerId: user.trainerId || null }, SECRET);
                // Log login? maybe too noisy.
                return res.json({ token, user: { id: user.id, name: user.name, role: user.role, trainerId: user.trainerId || null } });
            }
        }

        // 2. Try finding in MEMBER table
        const member = await prisma.member.findUnique({ where: { email } });
        if (member && member.password) { // Only if password is set
            if (await bcrypt.compare(password, member.password)) {
                const token = jwt.sign({ id: member.id, role: 'MEMBER', type: 'MEMBER' }, SECRET);
                return res.json({ token, user: { id: member.id, name: member.firstName, role: 'MEMBER' } });
            }
        }

        res.status(403).json({ error: "Invalid credentials" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Helper for Member Password Setup (Temporary/First-time)
app.post('/api/auth/member-setup', async (req, res) => {
    const { email, password } = req.body;
    try {
        const member = await prisma.member.findUnique({ where: { email } });
        if (!member) return res.status(404).json({ error: "Member not found" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.member.update({
            where: { email },
            data: { password: hashedPassword }
        });
        res.json({ message: "Password set successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- DASHBOARD ROUTES ---
app.get('/api/health-stats', async (req, res) => {
    try {
        const expenseSum = await prisma.expense.aggregate({ _sum: { amount: true } });
        const expenseCount = await prisma.expense.count();
        res.json({
            message: "Direct DB Check",
            totalAmount: expenseSum._sum.amount,
            count: expenseCount,
            dbUrl: process.env.DATABASE_URL
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        // If Member, return only their own stats (or simplified generic stats)
          if (req.user.role === 'MEMBER') {
              // Member specific dashboard logic here
              const member = await prisma.member.findUnique({
                  where: { id: req.user.id },
                  include: {
                      plan: true,
                      _count: { select: { accessLogs: true } }
                  }
              });
              const lastCheckIn = await prisma.accessLog.findFirst({
                  where: { memberId: req.user.id, status: 'ALLOWED' },
                  orderBy: { checkIn: 'desc' }
              });
              return res.json({
                  activeMembers: 0, // Not relevant for member
                  revenueToday: 0, // Not relevant
                  expiringSoon: member.expiryDate, // Show their expiry
                  memberData: member,
                  checkInsCount: member?._count?.accessLogs || 0,
                  lastCheckIn
              });
          }
        if (req.user.role === 'TRAINER') {
            const trainerId = req.user.trainerId;
            if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
            const upcomingSessions = await prisma.trainingSession.count({
                where: { trainerId: Number(trainerId), date: { gte: new Date() } }
            });
            const totalClasses = await prisma.class.count({ where: { trainerId: Number(trainerId) } });
            return res.json({
                upcomingSessions,
                totalClasses
            });
        }

        // ADMIN/STAFF stats
        const totalMembers = await prisma.member.count({ where: { status: 'ACTIVE' } });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayRevenue = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: today } }
        });

        // Calculate Net Profit (Month to Date)
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthlyRevenue = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { date: { gte: firstDayOfMonth } }
        });
        const monthlyExpenses = await prisma.expense.aggregate({
            _sum: { amount: true },
            where: { date: { gte: firstDayOfMonth } }
        });

        const totalRev = monthlyRevenue._sum.amount || 0;
        const totalExp = monthlyExpenses._sum.amount || 0;

        const expiring = await prisma.member.count({
            where: {
                expiryDate: {
                    lte: new Date(new Date().setDate(new Date().getDate() + 7)), // Next 7 days
                    gte: new Date()
                }
            }
        });

        res.json({
            activeMembers: totalMembers,
            revenueToday: todayRevenue._sum.amount || 0,
            monthlyRevenue: monthlyRevenue._sum.amount || 0,
            expiringSoon: expiring,
            netProfit: totalRev - totalExp,
            totalExpenses: totalExp
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- OWNER ROUTES ---

// Get Audit Logs (Owner Only)
app.get('/api/owner/audit-logs', authenticateToken, authorize('OWNER'), async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

// Manage Staff/Admins (List all users) - Owner/Admin view
// Owner sees all. Admin sees Staff only?
app.get('/api/users', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });
        // Admins should maybe not see Owners? 
        // For simplicity, returning all, frontend filters actions.
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Promote/Demote/Transfer (Owner Only)
app.post('/api/owner/role-change', authenticateToken, authorize('OWNER'), async (req, res) => {
    const { targetUserId, newRole } = req.body; // newRole: 'ADMIN' or 'STAFF'

    try {
        const target = await prisma.user.findUnique({ where: { id: Number(targetUserId) } });
        if (!target) return res.status(404).json({ error: "User not found" });

        if (newRole === 'OWNER') return res.status(400).json({ error: "Use transfer-ownership endpoint for Owner transfer" });
        if (target.role === 'OWNER') return res.status(403).json({ error: "Cannot change role of (self) Owner via this endpoint" });

        await prisma.user.update({
            where: { id: Number(targetUserId) },
            data: { role: newRole }
        });

        await logAudit("ROLE_CHANGE", req.user.email, target.email, `Changed role to ${newRole}`);
        res.json({ message: `User role updated to ${newRole}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Transfer Ownership
app.post('/api/owner/transfer-ownership', authenticateToken, authorize('OWNER'), async (req, res) => {
    const { newOwnerId } = req.body;

    try {
        // Transaction: Demote current Owner -> ADMIN, Promote new User -> OWNER
        const currentOwnerId = req.user.id; // From token

        if (currentOwnerId === Number(newOwnerId)) return res.status(400).json({ error: "Already owner" });

        await prisma.$transaction([
            prisma.user.update({
                where: { id: currentOwnerId },
                data: { role: 'ADMIN' }
            }),
            prisma.user.update({
                where: { id: Number(newOwnerId) },
                data: { role: 'OWNER' }
            })
        ]);

        await logAudit("OWNERSHIP_TRANSFER", req.user.email, `User ID ${newOwnerId}`, "Transferred system ownership");
        res.json({ message: "Ownership transferred successfully. Please log in again." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Transfer failed" });
    }
});

// --- MEMBER ROUTES ---
// Only Staff/Admin can list all members
app.get('/api/members', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    try {
        const members = await prisma.member.findMany({
            include: { plan: true }
        });
        res.json(members);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Member Self-Service APIs

// Get Available Classes (Member View)
app.get('/api/members/classes', authenticateToken, async (req, res) => {
    try {
        const classes = await prisma.class.findMany({
            include: {
                trainer: true,
                bookings: {
                    where: { memberId: req.user.id }
                }
            }
        });
        // Transform to indicate if booked
        const result = classes.map(c => ({
            ...c,
            isBooked: c.bookings.length > 0
        }));
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Book a Class
app.post('/api/members/book', authenticateToken, async (req, res) => {
    const { classId } = req.body;
    const memberId = req.user.id; // User ID from token (assuming Member login uses Member ID as ID)

    // Safety check: Ensure user is a member
    if (req.user.type !== 'MEMBER') return res.status(403).json({ error: "Only members can book classes" });

    try {
        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(404).json({ error: "Class not found" });

        if (cls.enrolled >= cls.capacity) return res.status(400).json({ error: "Class is full" });

        // Check if already booked
        const existing = await prisma.booking.findFirst({
            where: { memberId, classId, status: 'CONFIRMED' }
        });
        if (existing) return res.status(400).json({ error: "Already booked" });

        // Transaction: Create Booking + Increment Enrollment
        await prisma.$transaction([
            prisma.booking.create({
                data: { memberId, classId, status: 'CONFIRMED' }
            }),
            prisma.class.update({
                where: { id: classId },
                data: { enrolled: { increment: 1 } }
            })
        ]);

        res.json({ message: "Booking confirmed" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Cancel Booking
app.post('/api/members/cancel-booking', authenticateToken, async (req, res) => {
    const { classId } = req.body;
    const memberId = req.user.id;

    try {
        const booking = await prisma.booking.findFirst({
            where: { memberId, classId, status: 'CONFIRMED' }
        });
        if (!booking) return res.status(404).json({ error: "Booking not found" });

        await prisma.$transaction([
            prisma.booking.delete({ where: { id: booking.id } }),
            prisma.class.update({
                where: { id: classId },
                data: { enrolled: { decrement: 1 } }
            })
        ]);

        res.json({ message: "Booking cancelled" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Book a Trainer Session (Member)
app.post('/api/members/book-training', authenticateToken, authorize(['MEMBER']), async (req, res) => {
    const { trainerId, date, time, duration, notes, method } = req.body;
    const memberId = req.user.id;

    if (!trainerId || !date || !time || !duration || !method) {
        return res.status(400).json({ error: "Missing required booking details" });
    }
    const allowedMethods = ['CASH', 'CARD', 'GCASH'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        if (trainer.availableSlots !== null && trainer.availableSlots <= 0) {
            return res.status(400).json({ error: "Trainer is fully booked" });
        }

        const startDateTime = new Date(`${date}T${time}`);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date or time" });
        }

        const allowedDurations = (trainer.sessionDurations || '60')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
        if (!allowedDurations.includes(Number(duration))) {
            return res.status(400).json({ error: "Selected duration not available" });
        }

        const sessionRate = trainer.sessionPrice ?? 300;
        const totalAmount = (Number(duration) / 60) * Number(sessionRate);

        await prisma.$transaction(async (tx) => {
            await tx.trainingSession.create({
                data: {
                    memberId,
                    trainerId: Number(trainerId),
                    date: startDateTime,
                    duration: Number(duration),
                    price: totalAmount,
                    status: 'SCHEDULED',
                    paymentStatus: method === 'CASH' ? 'UNPAID' : 'PAID',
                    paymentMethod: method,
                    paidAt: method === 'CASH' ? null : new Date(),
                    notes: notes || null
                }
            });

            if (method !== 'CASH') {
                await tx.payment.create({
                    data: {
                        amount: totalAmount,
                        type: 'TRAINING',
                        method,
                        status: 'COMPLETED',
                        memberId
                    }
                });
            }

            if (trainer.availableSlots !== null) {
                await tx.trainer.update({
                    where: { id: Number(trainerId) },
                    data: { availableSlots: { decrement: 1 } }
                });
            }
        });

        res.json({ message: method === 'CASH' ? "Training session booked. Pay at the front desk." : "Training session booked and paid" });
    } catch (e) {
        res.status(500).json({ error: "Failed to book training session", detail: e?.message });
    }
});

// Book a Trainer Session (Cash, Unpaid) - Authenticated members only
app.post('/api/members/book-training-cash', authenticateToken, authorize(['MEMBER']), async (req, res) => {
    const { trainerId, date, time, duration, notes } = req.body;
    const resolvedMemberId = req.user.id;

    if (!trainerId || !date || !time || !duration) {
        return res.status(400).json({ error: "Missing required booking details" });
    }

    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        if (trainer.availableSlots !== null && trainer.availableSlots <= 0) {
            return res.status(400).json({ error: "Trainer is fully booked" });
        }

        const startDateTime = new Date(`${date}T${time}`);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date or time" });
        }

        const allowedDurations = (trainer.sessionDurations || '60')
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
        if (!allowedDurations.includes(Number(duration))) {
            return res.status(400).json({ error: "Selected duration not available" });
        }

        const sessionRate = trainer.sessionPrice ?? 300;
        const totalAmount = (Number(duration) / 60) * Number(sessionRate);

        await prisma.$transaction(async (tx) => {
            await tx.trainingSession.create({
                data: {
                    memberId: resolvedMemberId,
                    trainerId: Number(trainerId),
                    date: startDateTime,
                    duration: Number(duration),
                    price: totalAmount,
                    status: 'SCHEDULED',
                    paymentStatus: 'UNPAID',
                    paymentMethod: 'CASH',
                    paidAt: null,
                    notes: notes || null
                }
            });

            if (trainer.availableSlots !== null) {
                await tx.trainer.update({
                    where: { id: Number(trainerId) },
                    data: { availableSlots: { decrement: 1 } }
                });
            }
        });

        res.json({ message: "Training session booked. Pay at the front desk." });
    } catch (e) {
        res.status(500).json({ error: "Failed to book training session", detail: e?.message });
    }
});

// Staff/Admin book a trainer session for a member
app.post('/api/staff/book-training', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { memberId, trainerId, date, time, duration, notes, method } = req.body;
    if (!memberId || !trainerId || !date || !time || !duration || !method) {
        return res.status(400).json({ error: "Missing required booking details" });
    }
    const allowedMethods = ['CASH', 'CARD', 'GCASH'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: Number(trainerId) } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        if (trainer.availableSlots !== null && trainer.availableSlots <= 0) {
            return res.status(400).json({ error: "Trainer is fully booked" });
        }

        const startDateTime = new Date(`${date}T${time}`);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date or time" });
        }

        const totalAmount = ((trainer.sessionPrice || 0) / 60) * Number(duration);

          await prisma.$transaction(async (tx) => {
            await tx.trainingSession.create({
                data: {
                    memberId: Number(memberId),
                    trainerId: Number(trainerId),
                    date: startDateTime,
                    duration: Number(duration),
                    price: totalAmount,
                    status: 'SCHEDULED',
                    paymentStatus: 'PAID',
                    paymentMethod: method,
                    paidAt: new Date(),
                    notes: notes || null
                }
            });

            await tx.payment.create({
                data: {
                    amount: totalAmount,
                    type: 'TRAINING',
                    method,
                    status: 'COMPLETED',
                    memberId: Number(memberId),
                    cashierId: req.user.id
                }
            });

            if (trainer.availableSlots !== null) {
                await tx.trainer.update({
                    where: { id: Number(trainerId) },
                    data: { availableSlots: { decrement: 1 } }
                });
            }
    });

    res.json({ message: "Training session booked and paid" });
} catch (e) {
    res.status(500).json({ error: "Failed to book training session", detail: e?.message });
}
});

// Staff view trainer bookings (e.g., unpaid)
app.get('/api/staff/training-sessions', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { status } = req.query; // paymentStatus filter: UNPAID/PAID
    try {
        const where = status ? { paymentStatus: String(status).toUpperCase() } : {};
        const sessions = await prisma.trainingSession.findMany({
            where,
            include: { member: true, trainer: true },
            orderBy: { date: 'asc' }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Staff collect payment for an unpaid trainer booking
app.post('/api/staff/training-sessions/:id/collect', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const sessionId = Number(req.params.id);
    const { method = 'CASH', cashTendered } = req.body;
    const allowedMethods = ['CASH', 'CARD', 'GCASH'];
    if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: "Invalid payment method" });
    }

    try {
        const session = await prisma.trainingSession.findUnique({
            where: { id: sessionId },
            include: { member: true }
        });
        if (!session) return res.status(404).json({ error: "Training session not found" });
        if (session.paymentStatus === 'PAID') return res.status(400).json({ error: "Session already paid" });

        const amount = session.price;
        const tendered = method === 'CASH' && cashTendered !== undefined ? Number(cashTendered) : null;
        const changeDue = method === 'CASH' && tendered !== null ? Math.max(0, tendered - amount) : null;

        const payment = await prisma.$transaction(async (tx) => {
            const updated = await tx.trainingSession.update({
                where: { id: sessionId },
                data: {
                    paymentStatus: 'PAID',
                    paymentMethod: method,
                    paidAt: new Date()
                }
            });

            const payment = await tx.payment.create({
                data: {
                    amount,
                    type: 'TRAINING',
                    method,
                    status: 'COMPLETED',
                    memberId: session.memberId,
                    cashierId: req.user.id,
                    cashTendered: method === 'CASH' ? tendered : null,
                    changeDue: method === 'CASH' ? changeDue : null
                }
            });

            return { updated, payment };
        });

        res.json(payment);
    } catch (e) {
        res.status(500).json({ error: "Failed to collect payment", detail: e?.message });
    }
});

// Shop Checkout (Simple)
app.post('/api/members/checkout', authenticateToken, async (req, res) => {
    const { items, total } = req.body; // items: [{productId, quantity, price}]
    const memberId = req.user.id;

    try {
        // Create Order
        const order = await prisma.order.create({
            data: {
                memberId,
                total,
                status: 'COMPLETED',
                items: {
                    create: items.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        price: i.price
                    }))
                }
            }
        });

        // Deduct Stock
        for (const item of items) {
            await prisma.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } }
            });
        }

        // Award Loyalty Points (1 point per $10 spent)
        const points = Math.floor(total / 10);
        if (points > 0) {
            await prisma.member.update({
                where: { id: memberId },
                data: { points: { increment: points } }
            });
        }

        res.json({ message: "Order placed successfully!", orderId: order.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Checkout failed" });
    }
});

// Get Member Orders
app.get('/api/members/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { memberId: req.user.id },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Members can see their own profile; Staff/Admin can see any
app.get('/api/members/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Authorization check
    if (req.user.role === 'MEMBER' && req.user.id !== Number(id)) {
        return res.sendStatus(403);
    }

    try {
        const member = await prisma.member.findUnique({
            where: { id: Number(id) },
            include: {
                plan: true,
                payments: { orderBy: { date: 'desc' } },
                accessLogs: { orderBy: { checkIn: 'desc' }, take: 20 },
                membershipPeriods: { include: { plan: true }, orderBy: { startDate: 'desc' } }
            }
        });
        if (!member) return res.status(404).json({ error: "Member not found" });
        res.json(member);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Member Payment Methods
app.get('/api/members/:id/payment-methods', authenticateToken, async (req, res) => {
    const memberId = Number(req.params.id);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    try {
        const methods = await prisma.paymentMethod.findMany({
            where: { memberId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(methods);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/members/:id/payment-methods', authenticateToken, async (req, res) => {
    const memberId = Number(req.params.id);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    const { type, label, name, phone, brand, last4, expMonth, expYear, isDefault } = req.body;
    if (!type || !label) return res.status(400).json({ error: "Type and label are required" });
    if (!['GCASH', 'CARD'].includes(type)) return res.status(400).json({ error: "Invalid payment method type" });

    try {
        const existingCount = await prisma.paymentMethod.count({ where: { memberId } });
        const makeDefault = isDefault || existingCount === 0;

        const [method] = await prisma.$transaction([
            ...(makeDefault
                ? [prisma.paymentMethod.updateMany({ where: { memberId }, data: { isDefault: false } })]
                : []),
            prisma.paymentMethod.create({
                data: {
                    memberId,
                    type,
                    label,
                    name: name || null,
                    phone: phone || null,
                    brand: brand || null,
                    last4: last4 || null,
                    expMonth: expMonth || null,
                    expYear: expYear || null,
                    isDefault: makeDefault
                }
            })
        ]);

        res.json(method);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/members/:id/payment-methods/:methodId', authenticateToken, async (req, res) => {
    const memberId = Number(req.params.id);
    const methodId = Number(req.params.methodId);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    const { isDefault, label } = req.body;
    try {
        const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
        if (!method || method.memberId !== memberId) return res.status(404).json({ error: "Payment method not found" });

        if (isDefault) {
            await prisma.$transaction([
                prisma.paymentMethod.updateMany({ where: { memberId }, data: { isDefault: false } }),
                prisma.paymentMethod.update({ where: { id: methodId }, data: { isDefault: true } })
            ]);
            const updated = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
            return res.json(updated);
        }

        const updated = await prisma.paymentMethod.update({
            where: { id: methodId },
            data: { label: label || method.label }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/members/:id/payment-methods/:methodId', authenticateToken, async (req, res) => {
    const memberId = Number(req.params.id);
    const methodId = Number(req.params.methodId);
    if (req.user.role === 'MEMBER' && req.user.id !== memberId) return res.sendStatus(403);

    try {
        const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
        if (!method || method.memberId !== memberId) return res.status(404).json({ error: "Payment method not found" });

        await prisma.paymentMethod.delete({ where: { id: methodId } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Only Staff/Admin can create members
app.post('/api/members', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { firstName, lastName, email, phone, planId, imageUrl, birthDate, sex, paymentMethod, cashTendered, changeDue, gcashReference, gcashDate, gcashTime } = req.body;
    try {
        // Calculate expiry based on plan
        const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(startDate.getDate() + (plan ? plan.duration : 30));

        const member = await prisma.member.create({
            data: {
                firstName, lastName, email, phone, planId: Number(planId),
                startDate, expiryDate, imageUrl,
                birthDate: birthDate ? new Date(birthDate) : null,
                sex: sex || null,
                ...(planId ? {
                    membershipPeriods: {
                        create: {
                            planId: Number(planId),
                            startDate,
                            endDate: expiryDate,
                            amount: plan ? plan.price : null,
                            method: paymentMethod || null
                        }
                    }
                } : {})
            }
        });

        let payment = null;
        if (plan) {
            const pointsAwarded = Math.floor((plan.price * 58) / 100);
            const externalDate = (gcashDate && gcashTime) ? new Date(`${gcashDate}T${gcashTime}`) : null;
            payment = await prisma.payment.create({
                data: {
                    amount: plan.price,
                    type: 'MEMBERSHIP',
                    method: paymentMethod || 'CASH',
                    memberId: member.id,
                    cashierId: req.user.id,
                    pointsAwarded,
                    cashTendered: paymentMethod === 'CASH' ? (cashTendered !== undefined ? Number(cashTendered) : null) : null,
                    changeDue: paymentMethod === 'CASH' ? (changeDue !== undefined ? Number(changeDue) : null) : null,
                    externalRef: paymentMethod === 'GCASH' ? (gcashReference || null) : null,
                    externalDate: paymentMethod === 'GCASH' ? externalDate : null
                }
            });

            await prisma.paymentItem.create({
                data: {
                    paymentId: payment.id,
                    productId: null,
                    name: plan.name,
                    type: 'PLAN',
                    quantity: 1,
                    unitPrice: plan.price
                }
            });

            if (pointsAwarded > 0) {
                await prisma.member.update({
                    where: { id: member.id },
                    data: { points: { increment: pointsAwarded } }
                });
            }
        }

        res.json({ member, payment });

        if (plan) {
            await prisma.payment.create({
                data: {
                    amount: plan.price,
                    type: 'MEMBERSHIP',
                    method: paymentMethod || 'CASH',
                    memberId: member.id
                }
            });
        }

        res.json(member);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Only Staff/Admin can renew members (unless we add self-service later)
app.post('/api/members/:id/renew', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { id } = req.params;
    const { duration, amount, method, planId, cashTendered, changeDue, gcashReference, gcashDate, gcashTime } = req.body; // duration in days
    try {
        const member = await prisma.member.findUnique({ where: { id: Number(id) } });
        if (!member) return res.status(404).json({ error: "Member not found" });

        const now = new Date();
        const currentExpiry = member.expiryDate && new Date(member.expiryDate) > now ? new Date(member.expiryDate) : now;
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + Number(duration));

        const existingPeriods = await prisma.membershipPeriod.count({
            where: { memberId: Number(id) }
        });

        if (existingPeriods === 0 && member.planId && member.startDate && member.expiryDate) {
            await prisma.membershipPeriod.create({
                data: {
                    memberId: Number(id),
                    planId: member.planId,
                    startDate: member.startDate,
                    endDate: member.expiryDate
                }
            });
        }

        const updatedMember = await prisma.member.update({
            where: { id: Number(id) },
            data: {
                expiryDate: newExpiry,
                status: 'ACTIVE',
                ...(planId ? { planId: Number(planId) } : {})
            }
        });

        await prisma.membershipPeriod.create({
            data: {
                memberId: Number(id),
                planId: planId ? Number(planId) : member.planId,
                startDate: currentExpiry,
                endDate: newExpiry,
                amount: amount !== undefined && amount !== null ? parseFloat(amount) : null,
                method: method || null
            }
        });

        await prisma.membershipPeriod.create({
            data: {
                memberId: Number(id),
                planId: planId ? Number(planId) : member.planId,
                startDate: currentExpiry,
                endDate: newExpiry,
                amount: amount !== undefined && amount !== null ? parseFloat(amount) : null,
                method: method || null
            }
        });

        const externalDate = (gcashDate && gcashTime) ? new Date(`${gcashDate}T${gcashTime}`) : null;
        const pointsAwarded = Math.floor((parseFloat(amount) * 58) / 100);

        const payment = await prisma.payment.create({
            data: {
                amount: parseFloat(amount),
                type: 'MEMBERSHIP',
                method,
                memberId: Number(id),
                cashierId: req.user.id,
                pointsAwarded,
                cashTendered: method === 'CASH' ? (cashTendered !== undefined ? Number(cashTendered) : null) : null,
                changeDue: method === 'CASH' ? (changeDue !== undefined ? Number(changeDue) : null) : null,
                externalRef: method === 'GCASH' ? (gcashReference || null) : null,
                externalDate: method === 'GCASH' ? externalDate : null
            }
        });

        let planName = 'Membership Renewal';
        if (planId) {
            const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
            if (plan?.name) planName = plan.name;
        }

        await prisma.paymentItem.create({
            data: {
                paymentId: payment.id,
                productId: null,
                name: planName,
                type: 'PLAN',
                quantity: 1,
                unitPrice: parseFloat(amount)
            }
        });

        if (pointsAwarded > 0) {
            await prisma.member.update({
                where: { id: Number(id) },
                data: { points: { increment: pointsAwarded } }
            });
        }

        res.json({ member: updatedMember, payment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/members/:id/notes', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    const { id } = req.params;
    try {
        const notes = await prisma.memberNote.findMany({
            where: { memberId: Number(id) },
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { id: true, name: true, email: true } } }
        });
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch notes" });
    }
});

app.post('/api/members/:id/notes', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || !String(content).trim()) {
        return res.status(400).json({ error: "Note content required" });
    }
    try {
        const note = await prisma.memberNote.create({
            data: {
                memberId: Number(id),
                content: String(content).trim(),
                createdBy: req.user.id
            },
            include: { author: { select: { id: true, name: true, email: true } } }
        });
        res.json(note);
    } catch (e) {
        res.status(500).json({ error: "Failed to create note" });
    }
});

// Staff/Admin only
app.post('/api/members/:id/status', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { id } = req.params;
    const { status, freezeStartDate, freezeEndDate } = req.body;
    try {
        const updateData = { status };

        if (status === 'FREEZED') {
            updateData.freezeStartDate = freezeStartDate ? new Date(freezeStartDate) : null;
            updateData.freezeEndDate = freezeEndDate ? new Date(freezeEndDate) : null;
        } else if (status === 'ACTIVE') {
            // Clear freeze dates when reactivating
            updateData.freezeStartDate = null;
            updateData.freezeEndDate = null;
        }

        const member = await prisma.member.update({
            where: { id: Number(id) },
            data: updateData
        });
        res.json(member);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update member details (General)
app.put('/api/members/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'MEMBER']), async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, phone, imageUrl, birthDate, sex } = req.body;
    try {
        if (req.user.role === 'MEMBER' && req.user.id !== Number(id)) {
            return res.sendStatus(403);
        }
        const member = await prisma.member.update({
            where: { id: Number(id) },
            data: {
                firstName,
                lastName,
                email,
                phone,
                imageUrl,
                birthDate: birthDate ? new Date(birthDate) : null,
                sex: sex || null
            }
        });
        res.json(member);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/members/:id/change-password', authenticateToken, authorize(['MEMBER']), async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    if (req.user.id !== Number(id)) return res.sendStatus(403);
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
    }
    try {
        const member = await prisma.member.findUnique({ where: { id: Number(id) } });
        if (!member || !member.password) {
            return res.status(400).json({ error: "Password is not set for this account" });
        }
        const ok = await bcrypt.compare(currentPassword, member.password);
        if (!ok) return res.status(400).json({ error: "Current password is incorrect" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.member.update({
            where: { id: Number(id) },
            data: { password: hashedPassword }
        });
        res.json({ message: "Password updated" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ACCESS ROUTES ---
// Checkin is usually done by staff or automated kiosk (Staff role for now)
app.post('/api/access/checkin', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { memberId, status } = req.body;
    try {
        const log = await prisma.accessLog.create({
            data: {
                memberId: parseInt(memberId),
                status: status || 'ALLOWED'
            },
            include: { member: true }
        });

        // Update member last checkin
        if (status !== 'DENIED') {
            await prisma.member.update({
                where: { id: parseInt(memberId) },
                data: { lastCheckIn: new Date() }
            });
        }

        res.json(log);
    } catch (e) {
        res.status(500).json({ error: "Check-in failed" });
    }
});

app.get('/api/access/logs', authenticateToken, authorize(['ADMIN', 'STAFF', 'MEMBER']), async (req, res) => {
    try {
        const where = {};
        if (req.user.role === 'MEMBER') {
            where.memberId = req.user.id;
        }

        const logs = await prisma.accessLog.findMany({
            where,
            include: {
                member: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        status: true,
                        startDate: true,
                        createdAt: true,
                        expiryDate: true,
                        birthDate: true,
                        sex: true,
                        imageUrl: true,
                        plan: { select: { name: true } }
                    }
                }
            },
            include: {
                member: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        status: true,
                        startDate: true,
                        createdAt: true,
                        expiryDate: true,
                        birthDate: true,
                        sex: true,
                        imageUrl: true,
                        plan: { select: { name: true } }
                    }
                }
            },
            orderBy: { checkIn: 'desc' },
            take: 50
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// Aggregate access traffic for members without exposing member details
app.get('/api/access/traffic', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF', 'MEMBER']), async (req, res) => {
    try {
        const now = new Date();
        const startParam = req.query.start ? new Date(req.query.start) : null;
        const endParam = req.query.end ? new Date(req.query.end) : null;

        const startDate = startParam && !isNaN(startParam.getTime())
            ? startParam
            : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

        const endDate = endParam && !isNaN(endParam.getTime())
            ? endParam
            : now;

        const logs = await prisma.accessLog.findMany({
            where: {
                checkIn: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                checkIn: true,
                status: true
            },
            orderBy: { checkIn: 'desc' },
            take: 1000
        });

        res.json({
            range: {
                start: startDate,
                end: endDate
            },
            logs
        });
    } catch (e) {
        res.status(500).json({ error: "Traffic fetch failed" });
    }
});

app.get('/api/access/logs/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    const { id } = req.params;
    try {
        const log = await prisma.accessLog.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        status: true,
                        startDate: true,
                        createdAt: true,
                        expiryDate: true,
                        birthDate: true,
                        sex: true,
                        imageUrl: true,
                        plan: { select: { name: true } }
                    }
                }
            }
        });
        if (!log) return res.status(404).json({ error: "Log not found" });
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: "Fetch failed" });
    }
});



// --- SIMULATION ROUTES (For Testing) ---
app.post('/api/access/simulate', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    try {
        const { status } = req.body; // Allow forcing status
        // Try to find any existing member to use for the simulation
        let member = await prisma.member.findFirst();

        let memberId;
        if (member) {
            memberId = member.id;
        } else {
            // If no members exist, return error
            return res.status(400).json({ error: "No members found in database to simulate scan." });
        }

        const log = await prisma.accessLog.create({
            data: {
                memberId: memberId,
                status: status || 'ALLOWED', // Use provided status or default
                checkIn: new Date()
            },
            include: { member: { include: { plan: true } } }
        });
        res.json(log);
    } catch (e) {
        console.error("Simulation error:", e);
        res.status(500).json({ error: "Simulation failed: " + e.message });
    }
});

// --- POS ROUTES ---
// Payment creation - Members might pay online later, but for POS it's staff
app.post('/api/payments', authenticateToken, authorize(['ADMIN', 'STAFF', 'MEMBER']), async (req, res) => {
    const { amount, type, method, memberId, items, discount, cashTendered, changeDue, externalRef, externalDate } = req.body;
    const resolvedMemberId = req.user.role === 'MEMBER'
        ? req.user.id
        : (memberId ? Number(memberId) : null);

    try {
        const parsedAmount = parseFloat(amount);
        const pointsAwarded = resolvedMemberId ? Math.floor((parsedAmount * 58) / 100) : 0;
        const cashierId = req.user.role === 'MEMBER' ? null : req.user.id;

        // 1. Create Payment Record
        const payment = await prisma.payment.create({
            data: {
                amount: parsedAmount,
                type,
                method,
                memberId: resolvedMemberId,
                cashierId,
                pointsAwarded,
                cashTendered: method === 'CASH' ? (cashTendered !== undefined ? Number(cashTendered) : null) : null,
                changeDue: method === 'CASH' ? (changeDue !== undefined ? Number(changeDue) : null) : null,
                externalRef: method === 'GCASH' ? (externalRef || null) : null,
                externalDate: method === 'GCASH' && externalDate ? new Date(externalDate) : null,
                // store items in JSON or related if needed, but schema seems to rely on Orders or just plain
                // Payment logs?
                // The provided schema scan didn't show 'items' relation on Payment, but 'Order' has items.
                // However, the original code didn't save items to a relation in this route, so we'll stick to logic
                // side-effects.
            }
        });

        // 2. Process Items (Stock Deduction & Membership Updates)
        if (items && items.length > 0) {
            const paymentItems = items.map((item) => ({
                paymentId: payment.id,
                productId: item.type === 'PRODUCT' && item.id ? Number(item.id) : null,
                name: item.name || 'Item',
                type: item.type || 'PRODUCT',
                quantity: Number(item.quantity) || 1,
                unitPrice: parseFloat(item.price) || 0
            }));

            await prisma.paymentItem.createMany({ data: paymentItems });

            for (const item of items) {
                // A. Membership Plan Update
                if (item.type === 'PLAN') {
                    if (!resolvedMemberId) throw new Error("Member ID required for plan purchase");

                    const member = await prisma.member.findUnique({ where: { id: Number(resolvedMemberId) } });
                    if (!member) throw new Error("Member not found");

                    // Calculate new expiry
                    const currentExpiry = new Date(member.expiryDate) > new Date() ? new Date(member.expiryDate) :
                        new Date();
                    const newExpiry = new Date(currentExpiry);
                    // Add duration (days)
                    newExpiry.setDate(newExpiry.getDate() + (item.duration || 30));

                    await prisma.member.update({
                        where: { id: Number(resolvedMemberId) },
                        data: {
                            expiryDate: newExpiry,
                            status: 'ACTIVE',
                            planId: item.id // Update their plan to the new one
                        }
                    });
                }

                // B. Stock Deduction (Products)
                // Only deduct if it's a tracked product (has an ID and is not a quick-add service or Plan)
                else if (item.id && (!item.type || item.type === 'PRODUCT')) { // Tracked products
                    // Check if it's actually a product in DB
                    try {
                        await prisma.product.update({
                            where: { id: Number(item.id) },
                            data: { stock: { decrement: item.quantity } }
                        });
                    } catch (err) {
                        // Ignore if product not found (might be a custom item)
                        console.warn(`Could not update stock for item ${item.id}`);
                    }
                }
            }
        }

        // 3. Award Loyalty Points (1 point per 100 PHP spent, Rate: 58)
        if (memberId) {
            // Amount is in USD (e.g. 2.50). Convert to PHP (145) then divide by 100 => 1.45 => 1 pt.
            if (pointsAwarded > 0) {
                await prisma.member.update({
                    where: { id: Number(memberId) },
                    data: { points: { increment: pointsAwarded } }
                });
            }
        }

        res.json(payment);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/payments', authenticateToken, async (req, res) => {
    // Member: see own payments
    if (req.user.role === 'MEMBER') {
        const videos = await prisma.payment.findMany({
            where: { memberId: req.user.id },
            take: 50,
            orderBy: { date: 'desc' }
        });
        return res.json(videos);
    }

      if (req.user.role === 'STAFF') {
          const payments = await prisma.payment.findMany({
              where: {
                  OR: [
                      { cashierId: req.user.id },
                      { type: 'IN_APP_PURCHASE' }
                  ]
              },
              take: 50,
              orderBy: { date: 'desc' },
              include: { member: true, cashier: true }
          });
          return res.json(payments);
      }

    // Staff/Admin: see all
    const payments = await prisma.payment.findMany({
        take: 50,
        orderBy: { date: 'desc' },
        include: { member: true, cashier: true }
    });
    res.json(payments);
});

app.get('/api/payments/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    const paymentId = Number(req.params.id);
    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { member: true, items: true, cashier: true }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id && payment.type !== 'IN_APP_PURCHASE') {
            return res.status(403).json({ error: "Access denied" });
        }
        res.json(payment);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch payment" });
    }
});

app.post('/api/payments/:id/return-items', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    const paymentId = Number(req.params.id);
    const { pin, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No return items provided" });
    }

    try {
        const config = await getPosConfig();
        if (!config.returnPinHash) {
            return res.status(400).json({ error: "Return PIN is not configured" });
        }
        if (!pin || !(await bcrypt.compare(String(pin), config.returnPinHash))) {
            return res.status(403).json({ error: "Invalid PIN" });
        }

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { items: true }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (payment.status !== 'COMPLETED' && payment.status !== 'RETURNED') {
            return res.status(400).json({ error: "Only completed payments can be returned" });
        }

        let refundAmount = 0;
        let totalReturnedQty = 0;

        for (const reqItem of items) {
            const itemId = Number(reqItem.itemId);
            const qty = Number(reqItem.quantity) || 0;
            if (!itemId || qty <= 0) continue;

            const item = payment.items.find(i => i.id === itemId);
            if (!item) continue;
            if (!item.productId) continue;

            const availableQty = item.quantity - (item.returnedQuantity || 0);
            const returnQty = Math.min(availableQty, qty);
            if (returnQty <= 0) continue;

            refundAmount += returnQty * item.unitPrice;
            totalReturnedQty += returnQty;

            await prisma.paymentItem.update({
                where: { id: item.id },
                data: { returnedQuantity: { increment: returnQty } }
            });

            if (item.productId) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: returnQty } }
                });
            }
        }

        if (refundAmount <= 0) {
            return res.status(400).json({ error: "Nothing to return" });
        }

        const pointsReversal = payment.memberId ? Math.floor((refundAmount * 58) / 100) : 0;
        if (pointsReversal > 0) {
            await adjustMemberPoints(payment.memberId, -pointsReversal);
        }

        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'RETURNED',
                refundedAmount: { increment: refundAmount },
                pointsReversed: { increment: pointsReversal }
            },
            include: { member: true, items: true }
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to return items" });
    }
});

// --- POS SETTINGS (Admin/Owner) ---
app.get('/api/pos/settings', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const config = await getPosConfig();
        res.json({
            hasVoidPin: Boolean(config.voidPinHash),
            hasReturnPin: Boolean(config.returnPinHash)
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load POS settings" });
    }
});

app.post('/api/pos/settings', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { voidPin, returnPin } = req.body;
    try {
        if (voidPin === undefined && returnPin === undefined) {
            return res.status(400).json({ error: "No settings provided" });
        }

        const data = {};

        if (voidPin !== undefined) {
            if (voidPin === '') {
                data.voidPinHash = null;
            } else if (String(voidPin).length < POS_PIN_MIN_LENGTH) {
                return res.status(400).json({ error: `Void PIN must be at least ${POS_PIN_MIN_LENGTH} digits` });
            } else {
                data.voidPinHash = await bcrypt.hash(String(voidPin), 10);
            }
        }

        if (returnPin !== undefined) {
            if (returnPin === '') {
                data.returnPinHash = null;
            } else if (String(returnPin).length < POS_PIN_MIN_LENGTH) {
                return res.status(400).json({ error: `Return PIN must be at least ${POS_PIN_MIN_LENGTH} digits` });
            } else {
                data.returnPinHash = await bcrypt.hash(String(returnPin), 10);
            }
        }

        const config = await getPosConfig();
        await prisma.posConfig.update({
            where: { id: config.id },
            data
        });

        res.json({ message: "POS settings updated" });
    } catch (e) {
        res.status(500).json({ error: "Failed to update POS settings" });
    }
});

// --- POS VOID ---
app.post('/api/payments/:id/void', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    const { pin } = req.body;
    const paymentId = Number(req.params.id);

    try {
        const config = await getPosConfig();
        if (!config.voidPinHash) {
            return res.status(400).json({ error: "Void PIN is not configured" });
        }
        if (!pin || !(await bcrypt.compare(String(pin), config.voidPinHash))) {
            return res.status(403).json({ error: "Invalid PIN" });
        }

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { items: true }
        });
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (req.user.role === 'STAFF' && payment.cashierId !== req.user.id) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (payment.status !== 'COMPLETED') {
            return res.status(400).json({ error: "Only completed payments can be voided" });
        }

        for (const item of payment.items) {
            if (item.productId) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });
            }
        }

        const pointsReversal = payment.memberId ? (payment.pointsAwarded || 0) : 0;
        if (pointsReversal > 0) {
            await adjustMemberPoints(payment.memberId, -pointsReversal);
        }

        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'VOIDED',
                pointsReversed: { increment: pointsReversal }
            },
            include: { member: true, items: true }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to void payment" });
    }
});

// --- PLAN ROUTES ---
app.get('/api/plans', async (req, res) => {
    try {
        const plans = await prisma.plan.findMany();
        // Custom Sort Order
        const order = ['Yearly Pro', 'Monthly Standard', 'Student Monthly', 'Day Pass'];
        plans.sort((a, b) => {
            const indexA = order.indexOf(a.name);
            const indexB = order.indexOf(b.name);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });
        res.json(plans);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch plans" });
    }
});

// --- INVENTORY ROUTES ---
// Members can View products (e.g. shop)
app.get('/api/products', authenticateToken, async (req, res) => {
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    res.json(products);
});

// Staff/Admin can Manage products (Create/Update), but maybe restrict strict management to Admin?
// For now, let's keep Create/Update for Staff (restocking), but DELETE is Admin only.
app.post('/api/products', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { name, category, price, stock, minStock, imageUrl } = req.body;
    try {
        const product = await prisma.product.create({
            data: {
                name, category,
                price: parseFloat(price) || 0,
                stock: Number(stock) || 0,
                minStock: Number(minStock) || 0,
                imageUrl,
                supplyCost: parseFloat(req.body.supplyCost) || 0,
                supplierId: req.body.supplierId ? Number(req.body.supplierId) : null
            }
        });
        res.json(product);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/products/:id', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { id } = req.params;
    const { name, category, price, stock, minStock, imageUrl } = req.body;
    try {
        const product = await prisma.product.update({
            where: { id: Number(id) },
            data: {
                name, category,
                price: parseFloat(price) || 0,
                stock: Number(stock) || 0,
                minStock: Number(minStock) || 0,
                imageUrl,
                supplyCost: parseFloat(req.body.supplyCost) || 0,
                supplierId: req.body.supplierId ? Number(req.body.supplierId) : null
            }
        });
        res.json(product);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE Product - OWNER or ADMIN only
app.delete('/api/products/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
        const product = await prisma.product.findUnique({ where: { id: Number(id) } });
        await prisma.product.delete({ where: { id: Number(id) } });
        await logAudit("DELETE_PRODUCT", req.user.email, product?.name, `ID: ${id}`);
        res.json({ message: "Product deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete product" });
    }
});


// --- TRAINER ROUTES ---
app.get('/api/trainers', authenticateToken, async (req, res) => {
    const trainers = await prisma.trainer.findMany({ include: { classes: true } });
    res.json(trainers);
});

app.post('/api/trainers', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const {
        name,
        specialty,
        specialization,
        email,
        phone,
        bio,
        imageUrl,
        experience,
        rating,
        sessionPrice,
        sessionDurations,
        availableSlots,
        specialties,
        createLogin,
        loginEmail,
        loginPassword
    } = req.body;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const trainer = await tx.trainer.create({
                data: {
                    name,
                    specialty,
                    specialization,
                    email,
                    phone,
                    bio,
                    imageUrl,
                    experience: experience !== undefined && experience !== '' ? Number(experience) : undefined,
                    rating: rating !== undefined && rating !== '' ? Number(rating) : undefined,
                    sessionPrice: sessionPrice !== undefined && sessionPrice !== '' ? Number(sessionPrice) : undefined,
                    sessionDurations,
                    availableSlots: availableSlots !== undefined && availableSlots !== '' ? Number(availableSlots) : undefined,
                    specialties
                }
            });

            let loginUser = null;
            if (createLogin && loginEmail && loginPassword) {
                const existing = await tx.user.findUnique({ where: { email: loginEmail } });
                if (existing) {
                    throw new Error("Login email is already in use.");
                }
                const hashedPassword = await bcrypt.hash(loginPassword, 10);
                loginUser = await tx.user.create({
                    data: {
                        email: loginEmail,
                        password: hashedPassword,
                        name: trainer.name,
                        role: 'TRAINER',
                        trainerId: trainer.id
                    }
                });
            }

            return { trainer, loginUser };
        });

        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e?.message || "Failed to create trainer" });
    }
});

app.post('/api/trainers/:id/create-login', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const trainerId = Number(req.params.id);
    const { loginEmail, loginPassword } = req.body;
    if (!loginEmail || !loginPassword) {
        return res.status(400).json({ error: "Login email and password are required." });
    }
    try {
        const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });

        const existingUser = await prisma.user.findUnique({ where: { email: loginEmail } });
        if (existingUser) return res.status(400).json({ error: "Login email is already in use." });

        const existingLink = await prisma.user.findFirst({ where: { trainerId } });
        if (existingLink) return res.status(400).json({ error: "Trainer already has a login." });

        const hashedPassword = await bcrypt.hash(loginPassword, 10);
        const user = await prisma.user.create({
            data: {
                email: loginEmail,
                password: hashedPassword,
                name: trainer.name,
                role: 'TRAINER',
                trainerId
            }
        });
        res.json({ user });
    } catch (e) {
        res.status(500).json({ error: "Failed to create trainer login", detail: e?.message });
    }
});

app.put('/api/trainers/:id', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const trainerId = Number(req.params.id);
    const {
        name,
        specialty,
        specialization,
        email,
        phone,
        bio,
        imageUrl,
        experience,
        rating,
        sessionPrice,
        sessionDurations,
        availableSlots,
        specialties
    } = req.body;

    try {
        const trainer = await prisma.trainer.update({
            where: { id: trainerId },
            data: {
                name,
                specialty,
                specialization,
                email,
                phone,
                bio,
                imageUrl,
                experience: experience !== undefined && experience !== '' ? Number(experience) : undefined,
                rating: rating !== undefined && rating !== '' ? Number(rating) : undefined,
                sessionPrice: sessionPrice !== undefined && sessionPrice !== '' ? Number(sessionPrice) : undefined,
                sessionDurations,
                availableSlots: availableSlots !== undefined && availableSlots !== '' ? Number(availableSlots) : undefined,
                specialties
            }
        });
        res.json(trainer);
    } catch (e) {
        res.status(500).json({ error: "Failed to update trainer", detail: e?.message });
    }
});

app.delete('/api/trainers/:id', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const trainerId = Number(req.params.id);
    try {
        const classes = await prisma.class.findMany({
            where: { trainerId },
            select: { id: true }
        });
        const classIds = classes.map((cls) => cls.id);

        await prisma.$transaction(async (tx) => {
            await tx.user.deleteMany({ where: { trainerId } });
            if (classIds.length > 0) {
                await tx.booking.deleteMany({ where: { classId: { in: classIds } } });
                await tx.class.deleteMany({ where: { id: { in: classIds } } });
            }

            await tx.trainingSession.deleteMany({ where: { trainerId } });
            await tx.trainer.delete({ where: { id: trainerId } });
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete trainer", detail: e?.message });
    }
    const {
        name,
        specialty,
        specialization,
        email,
        phone,
        bio,
        imageUrl,
        experience,
        rating,
        sessionPrice,
        sessionDurations,
        availableSlots,
        specialties
    } = req.body;
    const trainer = await prisma.trainer.create({
        data: {
            name,
            specialty,
            specialization,
            email,
            phone,
            bio,
            imageUrl,
            experience: experience !== undefined && experience !== '' ? Number(experience) : undefined,
            rating: rating !== undefined && rating !== '' ? Number(rating) : undefined,
            sessionPrice: sessionPrice !== undefined && sessionPrice !== '' ? Number(sessionPrice) : undefined,
            sessionDurations,
            availableSlots: availableSlots !== undefined && availableSlots !== '' ? Number(availableSlots) : undefined,
            specialties
        }
    });
    res.json(trainer);
});

app.put('/api/trainers/:id', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const trainerId = Number(req.params.id);
    const {
        name,
        specialty,
        specialization,
        email,
        phone,
        bio,
        imageUrl,
        experience,
        rating,
        sessionPrice,
        sessionDurations,
        availableSlots,
        specialties
    } = req.body;

    try {
        const trainer = await prisma.trainer.update({
            where: { id: trainerId },
            data: {
                name,
                specialty,
                specialization,
                email,
                phone,
                bio,
                imageUrl,
                experience: experience !== undefined && experience !== '' ? Number(experience) : undefined,
                rating: rating !== undefined && rating !== '' ? Number(rating) : undefined,
                sessionPrice: sessionPrice !== undefined && sessionPrice !== '' ? Number(sessionPrice) : undefined,
                sessionDurations,
                availableSlots: availableSlots !== undefined && availableSlots !== '' ? Number(availableSlots) : undefined,
                specialties
            }
        });
        res.json(trainer);
    } catch (e) {
        res.status(500).json({ error: "Failed to update trainer", detail: e?.message });
    }
});

app.delete('/api/trainers/:id', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const trainerId = Number(req.params.id);
    try {
        const classes = await prisma.class.findMany({
            where: { trainerId },
            select: { id: true }
        });
        const classIds = classes.map((cls) => cls.id);

        await prisma.$transaction(async (tx) => {
            if (classIds.length > 0) {
                await tx.booking.deleteMany({ where: { classId: { in: classIds } } });
                await tx.class.deleteMany({ where: { id: { in: classIds } } });
            }

            await tx.trainingSession.deleteMany({ where: { trainerId } });
            await tx.trainer.delete({ where: { id: trainerId } });
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete trainer", detail: e?.message });
    }
});

app.get('/api/trainers/:id', authenticateToken, async (req, res) => {
    try {
        const trainer = await prisma.trainer.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                classes: true,
                trainingSessions: {
                    include: { member: true },
                    take: 10,
                    orderBy: { date: 'desc' }
                }
            }
        });
        res.json(trainer);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer profile" });
    }
});

app.get('/api/trainers/:id/sessions', authenticateToken, async (req, res) => {
    try {
        const sessions = await prisma.trainingSession.findMany({
            where: { trainerId: Number(req.params.id) },
            include: { member: true },
            orderBy: { date: 'desc' }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions" });
    }
});

// --- TRAINER SELF-SERVICE ROUTES ---
app.get('/api/trainer/me', authenticateToken, authorize(['TRAINER']), async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const trainer = await prisma.trainer.findUnique({
            where: { id: Number(trainerId) },
            include: { classes: true }
        });
        if (!trainer) return res.status(404).json({ error: "Trainer not found" });
        res.json(trainer);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch trainer profile" });
    }
});

app.get('/api/trainer/me/sessions', authenticateToken, authorize(['TRAINER']), async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const sessions = await prisma.trainingSession.findMany({
            where: { trainerId: Number(trainerId) },
            include: { member: true },
            orderBy: { date: 'asc' }
        });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch training sessions" });
    }
});

app.post('/api/trainer/me/sessions/:id/complete', authenticateToken, authorize(['TRAINER']), async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const sessionId = Number(req.params.id);
        const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
        if (!session || session.trainerId !== Number(trainerId)) {
            return res.status(403).json({ error: "Access denied" });
        }
        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED' }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to complete session", detail: e?.message });
    }
});

app.patch('/api/trainer/me/sessions/:id', authenticateToken, authorize(['TRAINER']), async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const sessionId = Number(req.params.id);
        const { date, time, duration, notes } = req.body;

        const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
        if (!session || session.trainerId !== Number(trainerId)) {
            return res.status(403).json({ error: "Access denied" });
        }

        let nextDateTime = session.date;
        if (date || time) {
            const current = new Date(session.date);
            const yyyyMmDd = date || current.toISOString().split('T')[0];
            const hhmm = time || `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
            const composed = new Date(`${yyyyMmDd}T${hhmm}`);
            if (isNaN(composed.getTime())) {
                return res.status(400).json({ error: "Invalid date or time" });
            }
            nextDateTime = composed;
        }

        let nextDuration = session.duration;
        if (duration !== undefined && duration !== null && duration !== '') {
            const numeric = Number(duration);
            if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 480) {
                return res.status(400).json({ error: "Invalid duration" });
            }
            nextDuration = Math.round(numeric);
        }

        const updated = await prisma.trainingSession.update({
            where: { id: sessionId },
            data: {
                date: nextDateTime,
                duration: nextDuration,
                notes: notes !== undefined ? (notes || null) : session.notes
            }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update session", detail: e?.message });
    }
});

app.get('/api/trainer/me/classes', authenticateToken, authorize(['TRAINER']), async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const classes = await prisma.class.findMany({
            where: { trainerId: Number(trainerId) },
            include: {
                trainer: true,
                bookings: {
                    include: { member: true },
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { dayOfWeek: 'asc' }
        });
        res.json(classes);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch classes" });
    }
});

app.patch('/api/trainer/me/classes/:classId/attendees/:bookingId', authenticateToken, authorize(['TRAINER']), async (req, res) => {
    try {
        const trainerId = req.user.trainerId;
        if (!trainerId) return res.status(400).json({ error: "Trainer account is not linked" });
        const classId = Number(req.params.classId);
        const bookingId = Number(req.params.bookingId);
        const { status } = req.body;
        const allowed = ['CONFIRMED', 'ATTENDED', 'CANCELLED'];
        if (!allowed.includes(String(status).toUpperCase())) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls || cls.trainerId !== Number(trainerId)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.classId !== classId) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const updated = await prisma.booking.update({
            where: { id: bookingId },
            data: { status: String(status).toUpperCase() }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update attendee status", detail: e?.message });
    }
});

// --- CLASS ROUTES ---
app.get('/api/classes', authenticateToken, async (req, res) => {
    const where = req.user.role === 'TRAINER' ? { trainerId: Number(req.user.trainerId) } : {};
    const classes = await prisma.class.findMany({
        where,
        include: {
            trainer: true,
            bookings: {
                include: { member: true }
            }
        },
        orderBy: { dayOfWeek: 'asc' }
    });
    res.json(classes);
});

app.get('/api/classes/:id/participants', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'TRAINER') {
            const cls = await prisma.class.findUnique({ where: { id: Number(req.params.id) } });
            if (!cls || cls.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        const participants = await prisma.booking.findMany({
            where: { classId: Number(req.params.id) },
            include: { member: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(participants);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch participants" });
    }
});

app.post('/api/classes', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), async (req, res) => {
    const { name, trainerId, dayOfWeek, time, duration, capacity } = req.body;
    const resolvedTrainerId = req.user.role === 'TRAINER' ? Number(req.user.trainerId) : Number(trainerId);
    if (!resolvedTrainerId) return res.status(400).json({ error: "Trainer is required" });
    const gymClass = await prisma.class.create({
        data: {
            name, dayOfWeek, time,
            duration: Number(duration),
            capacity: Number(capacity),
            trainerId: resolvedTrainerId
        }
    });
    res.json(gymClass);
});

app.put('/api/classes/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), async (req, res) => {
    const classId = Number(req.params.id);
    const { name, trainerId, dayOfWeek, time, duration, capacity } = req.body;
    try {
        if (req.user.role === 'TRAINER') {
            const existing = await prisma.class.findUnique({ where: { id: classId } });
            if (!existing || existing.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        const resolvedTrainerId = req.user.role === 'TRAINER'
            ? Number(req.user.trainerId)
            : (trainerId !== undefined && trainerId !== '' ? Number(trainerId) : undefined);
        const gymClass = await prisma.class.update({
            where: { id: classId },
            data: {
                name,
                dayOfWeek,
                time,
                duration: duration !== undefined && duration !== '' ? Number(duration) : undefined,
                capacity: capacity !== undefined && capacity !== '' ? Number(capacity) : undefined,
                trainerId: resolvedTrainerId
            }
        });
        res.json(gymClass);
    } catch (e) {
        res.status(500).json({ error: "Failed to update class", detail: e?.message });
    }
});

app.delete('/api/classes/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), async (req, res) => {
    const classId = Number(req.params.id);
    try {
        if (req.user.role === 'TRAINER') {
            const existing = await prisma.class.findUnique({ where: { id: classId } });
            if (!existing || existing.trainerId !== Number(req.user.trainerId)) {
                return res.status(403).json({ error: "Access denied" });
            }
        }
        await prisma.$transaction(async (tx) => {
            await tx.booking.deleteMany({ where: { classId } });
            await tx.class.delete({ where: { id: classId } });
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete class", detail: e?.message });
    }
});

app.put('/api/classes/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), async (req, res) => {
    const classId = Number(req.params.id);
    const { name, trainerId, dayOfWeek, time, duration, capacity } = req.body;
    try {
        const gymClass = await prisma.class.update({
            where: { id: classId },
            data: {
                name,
                dayOfWeek,
                time,
                duration: duration !== undefined && duration !== '' ? Number(duration) : undefined,
                capacity: capacity !== undefined && capacity !== '' ? Number(capacity) : undefined,
                trainerId: trainerId !== undefined && trainerId !== '' ? Number(trainerId) : undefined
            }
        });
        res.json(gymClass);
    } catch (e) {
        res.status(500).json({ error: "Failed to update class", detail: e?.message });
    }
});

app.delete('/api/classes/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), async (req, res) => {
    const classId = Number(req.params.id);
    try {
        await prisma.$transaction(async (tx) => {
            await tx.booking.deleteMany({ where: { classId } });
            await tx.class.delete({ where: { id: classId } });
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete class", detail: e?.message });
    }
});

// --- LOYALTY ROUTES ---
app.get('/api/loyalty/rewards', authenticateToken, async (req, res) => {
    const rewards = await prisma.loyaltyReward.findMany();
    res.json(rewards);
});

app.post('/api/loyalty/rewards', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    try {
        const { name, cost, category, description, imageUrl } = req.body;
        const reward = await prisma.loyaltyReward.create({
            data: {
                name,
                cost: parseInt(cost) || 0,
                category: category || 'MERCHANDISE',
                description,
                imageUrl
            }
        });
        res.json(reward);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/loyalty/rewards/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, cost, category, description, imageUrl } = req.body;
        const reward = await prisma.loyaltyReward.update({
            where: { id: Number(id) },
            data: {
                name,
                cost: parseInt(cost) || 0,
                category,
                description,
                imageUrl
            }
        });
        res.json(reward);
    } catch (e) {
        console.error("Update Reward Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/loyalty/rewards/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.loyaltyReward.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// (Simple endpoint to add points manually for now)
app.post('/api/members/:id/points', authenticateToken, authorize(['ADMIN', 'STAFF']), async (req, res) => {
    const { id } = req.params;
    const { points, type } = req.body; // type=ADD or REDEEM
    // Simple logic update
    const member = await prisma.member.findUnique({ where: { id: Number(id) } });
    if (!member) return res.status(404).json({ error: "Member not found" });

    let newPoints = member.points;
    if (type === 'ADD') newPoints += Number(points);
    if (type === 'REDEEM') {
        if (member.points < Number(points)) return res.status(400).json({ error: "Insufficient points" });
        newPoints -= Number(points);
    }

    const updated = await prisma.member.update({
        where: { id: Number(id) },
        data: { points: newPoints }
    });
    res.json(updated);
});

// --- NOTIFICATION ROUTES ---
app.get('/api/notifications', authenticateToken, async (req, res) => {
    const notifs = await prisma.notification.findMany({
        orderBy: { date: 'desc' },
        take: 50
    });
    res.json(notifs);
});

// --- SUPPLIER ROUTES ---

// Get All Suppliers
app.get('/api/suppliers', authenticateToken, async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(suppliers);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch suppliers" });
    }
});

// Create Supplier
app.post('/api/suppliers', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { name, contact, email, address, notes } = req.body;
    try {
        const supplier = await prisma.supplier.create({
            data: { name, contact, email, address, notes }
        });
        await logAudit("CREATE_SUPPLIER", req.user.id.toString(), `Supplier: ${supplier.name}`, "Created new supplier");
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to create supplier" });
    }
});

// Update Supplier
app.put('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { name, contact, email, address, notes } = req.body;
    try {
        const supplier = await prisma.supplier.update({
            where: { id: Number(id) },
            data: { name, contact, email, address, notes }
        });
        await logAudit("UPDATE_SUPPLIER", req.user.id.toString(), `Supplier: ${supplier.name}`, "Updated details");
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to update supplier" });
    }
});

// Delete Supplier
app.delete('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
        // Check for linked expenses/products?
        // For now, allow delete (will set constraints later if needed or rely on cascade)
        // Prisma default might fail if relations exist without cascade.
        // Let's check first.
        const linkedProducts = await prisma.product.count({ where: { supplierId: Number(id) } });
        if (linkedProducts > 0) {
            return res.status(400).json({ error: "Cannot delete supplier with linked products" });
        }

        await prisma.supplier.delete({ where: { id: Number(id) } });
        await logAudit("DELETE_SUPPLIER", req.user.id.toString(), `Supplier ID: ${id}`, "Deleted supplier");
        res.json({ message: "Supplier deleted" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- INVENTORY RESTOCK ROUTE ---
app.post('/api/inventory/restock', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { productId, quantity, notes } = req.body;

    if (!productId || !quantity) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 1. Get Product to retrieve Fixed Cost and Assigned Supplier
        const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
        if (!product) return res.status(404).json({ error: "Product not found" });

        // Enforce Supplier Isolation
        if (!product.supplierId) {
            return res.status(400).json({ error: "Product has no assigned supplier. Please link a supplier first." });
        }

        // Use the product's fixed USD supply cost directly. 
        // Frontend will handle display conversion.
        const costPerUnit = product.supplyCost || 0;
        const totalCost = Number(quantity) * costPerUnit;

        // 3. Update Stock
        const updatedProduct = await prisma.product.update({
            where: { id: Number(productId) },
            data: {
                stock: { increment: Number(quantity) }
            }
        });

        // 4. Create Expense Record
        const expense = await prisma.expense.create({
            data: {
                title: `Restock: ${product.name} (x${quantity})`,
                amount: totalCost,
                category: "INVENTORY",
                date: new Date(),
                notes: notes || `Restocked ${quantity} units @ ${costPerUnit}/unit (Fixed Cost)`,
                recordedBy: req.user.id.toString(),
                supplierId: product.supplierId // Strictly use product's supplier
            }
        });

        // 5. Audit Log
        await logAudit(
            "RESTOCK_INVENTORY",
            req.user.id.toString(),
            `Product: ${product.name}`,
            `Added ${quantity} units. Fixed Cost: ${totalCost}`
        );

        res.json({
            message: "Restock successful",
            newStock: updatedProduct.stock,
            expenseId: expense.id
        });

    } catch (e) {
        console.error("Restock Error:", e);
        res.status(500).json({ error: "Restock failed" });
    }
});


// --- EXPENSE ROUTES ---
app.get('/api/expenses', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { start, end, category } = req.query;
        const where = {};
        if (start && end) {
            where.date = {
                gte: new Date(start),
                lte: new Date(end)
            };
        }
        if (category) where.category = category;

        const expenses = await prisma.expense.findMany({
            where,
            orderBy: { date: 'desc' }
        });
        res.json(expenses);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch expenses" });
    }
});

app.post('/api/expenses', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { title, amount, category, date, recurring, frequency, notes } = req.body;
        const expense = await prisma.expense.create({
            data: {
                title,
                amount: parseFloat(amount),
                category,
                date: new Date(date),
                recurring: recurring || false,
                frequency,
                notes,
                recordedBy: req.user.email
            }
        });
        res.json(expense);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/expenses/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        await prisma.expense.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Expense deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete expense" });
    }
});

// --- SUPPLIER ROUTES ---
app.get('/api/suppliers', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
        res.json(suppliers);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch suppliers" });
    }
});

app.post('/api/suppliers', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { name, contact, email, address, notes } = req.body;
        const supplier = await prisma.supplier.create({
            data: { name, contact, email, address, notes }
        });
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact, email, address, notes } = req.body;
        const supplier = await prisma.supplier.update({
            where: { id: Number(id) },
            data: { name, contact, email, address, notes }
        });
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        await prisma.supplier.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Supplier deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete supplier" });
    }
});

// --- INVENTORY RESTOCK ROUTE ---
app.post('/api/inventory/restock', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { productId, supplierId, quantity, costPerUnit, notes } = req.body;

    // Validation
    if (!productId || !quantity || !costPerUnit) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const totalCost = parseFloat(quantity) * parseFloat(costPerUnit);
        const product = await prisma.product.findUnique({ where: { id: Number(productId) } });

        if (!product) return res.status(404).json({ error: "Product not found" });

        // Transaction: Update Stock + Create Expense
        await prisma.$transaction([
            prisma.product.update({
                where: { id: Number(productId) },
                data: { stock: { increment: Number(quantity) } }
            }),
            prisma.expense.create({
                data: {
                    title: `Restock: ${product.name} (x${quantity})`,
                    amount: totalCost,
                    category: 'INVENTORY',
                    date: new Date(),
                    recurring: false,
                    notes: notes || `Restocked ${quantity} units @ ${costPerUnit}/unit`,
                    recordedBy: req.user.email,
                    supplierId: supplierId ? Number(supplierId) : null
                }
            })
        ]);

        res.json({ message: "Stock updated and expense recorded successfully" });
    } catch (e) {
        console.error("Restock Error:", e);
        res.status(500).json({ error: "Restock failed: " + e.message });
    }
});

// --- SUPPLIER ROUTES ---

// Get All Suppliers
app.get('/api/suppliers', authenticateToken, async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(suppliers);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch suppliers" });
    }
});

// Create Supplier
app.post('/api/suppliers', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { name, contact, email, address, notes } = req.body;
    try {
        const supplier = await prisma.supplier.create({
            data: { name, contact, email, address, notes }
        });
        await logAudit("CREATE_SUPPLIER", req.user.id.toString(), `Supplier: ${supplier.name}`, "Created new supplier");
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to create supplier" });
    }
});

// Update Supplier
app.put('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { id } = req.params;
    const { name, contact, email, address, notes } = req.body;
    try {
        const supplier = await prisma.supplier.update({
            where: { id: Number(id) },
            data: { name, contact, email, address, notes }
        });
        await logAudit("UPDATE_SUPPLIER", req.user.id.toString(), `Supplier: ${supplier.name}`, "Updated details");
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to update supplier" });
    }
});

// Delete Supplier
app.delete('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
        // Check for linked expenses/products?
        // For now, allow delete (will set constraints later if needed or rely on cascade)
        // Prisma default might fail if relations exist without cascade.
        // Let's check first.
        const linkedProducts = await prisma.product.count({ where: { supplierId: Number(id) } });
        if (linkedProducts > 0) {
            return res.status(400).json({ error: "Cannot delete supplier with linked products" });
        }

        await prisma.supplier.delete({ where: { id: Number(id) } });
        await logAudit("DELETE_SUPPLIER", req.user.id.toString(), `Supplier ID: ${id}`, "Deleted supplier");
        res.json({ message: "Supplier deleted" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- INVENTORY RESTOCK ROUTE ---
app.post('/api/inventory/restock', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { productId, quantity, notes } = req.body;

    if (!productId || !quantity) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 1. Get Product to retrieve Fixed Cost and Assigned Supplier
        const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
        if (!product) return res.status(404).json({ error: "Product not found" });

        // Enforce Supplier Isolation
        if (!product.supplierId) {
            return res.status(400).json({ error: "Product has no assigned supplier. Please link a supplier first." });
        }

        // Use the product's fixed USD supply cost directly. 
        // Frontend will handle display conversion.
        const costPerUnit = product.supplyCost || 0;
        const totalCost = Number(quantity) * costPerUnit;

        // 3. Update Stock
        const updatedProduct = await prisma.product.update({
            where: { id: Number(productId) },
            data: {
                stock: { increment: Number(quantity) }
            }
        });

        // 4. Create Expense Record
        const expense = await prisma.expense.create({
            data: {
                title: `Restock: ${product.name} (x${quantity})`,
                amount: totalCost,
                category: "INVENTORY",
                date: new Date(),
                notes: notes || `Restocked ${quantity} units @ ${costPerUnit}/unit (Fixed Cost)`,
                recordedBy: req.user.id.toString(),
                supplierId: product.supplierId // Strictly use product's supplier
            }
        });

        // 5. Audit Log
        await logAudit(
            "RESTOCK_INVENTORY",
            req.user.id.toString(),
            `Product: ${product.name}`,
            `Added ${quantity} units. Fixed Cost: ${totalCost}`
        );

        res.json({
            message: "Restock successful",
            newStock: updatedProduct.stock,
            expenseId: expense.id
        });

    } catch (e) {
        console.error("Restock Error:", e);
        res.status(500).json({ error: "Restock failed" });
    }
});


// --- EXPENSE ROUTES ---
app.get('/api/expenses', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { start, end, category } = req.query;
        const where = {};
        if (start && end) {
            where.date = {
                gte: new Date(start),
                lte: new Date(end)
            };
        }
        if (category) where.category = category;

        const expenses = await prisma.expense.findMany({
            where,
            orderBy: { date: 'desc' }
        });
        res.json(expenses);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch expenses" });
    }
});

app.post('/api/expenses', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { title, amount, category, date, recurring, frequency, notes } = req.body;
        const expense = await prisma.expense.create({
            data: {
                title,
                amount: parseFloat(amount),
                category,
                date: new Date(date),
                recurring: recurring || false,
                frequency,
                notes,
                recordedBy: req.user.email
            }
        });
        res.json(expense);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/expenses/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        await prisma.expense.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Expense deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete expense" });
    }
});

// --- SUPPLIER ROUTES ---
app.get('/api/suppliers', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
        res.json(suppliers);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch suppliers" });
    }
});

app.post('/api/suppliers', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { name, contact, email, address, notes } = req.body;
        const supplier = await prisma.supplier.create({
            data: { name, contact, email, address, notes }
        });
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact, email, address, notes } = req.body;
        const supplier = await prisma.supplier.update({
            where: { id: Number(id) },
            data: { name, contact, email, address, notes }
        });
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/suppliers/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        await prisma.supplier.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Supplier deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete supplier" });
    }
});

// --- INVENTORY RESTOCK ROUTE ---
app.post('/api/inventory/restock', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    const { productId, supplierId, quantity, costPerUnit, notes } = req.body;

    // Validation
    if (!productId || !quantity || !costPerUnit) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const totalCost = parseFloat(quantity) * parseFloat(costPerUnit);
        const product = await prisma.product.findUnique({ where: { id: Number(productId) } });

        if (!product) return res.status(404).json({ error: "Product not found" });

        // Transaction: Update Stock + Create Expense
        await prisma.$transaction([
            prisma.product.update({
                where: { id: Number(productId) },
                data: { stock: { increment: Number(quantity) } }
            }),
            prisma.expense.create({
                data: {
                    title: `Restock: ${product.name} (x${quantity})`,
                    amount: totalCost,
                    category: 'INVENTORY',
                    date: new Date(),
                    recurring: false,
                    notes: notes || `Restocked ${quantity} units @ ${costPerUnit}/unit`,
                    recordedBy: req.user.email,
                    supplierId: supplierId ? Number(supplierId) : null
                }
            })
        ]);

        res.json({ message: "Stock updated and expense recorded successfully" });
    } catch (e) {
        console.error("Restock Error:", e);
        res.status(500).json({ error: "Restock failed: " + e.message });
    }
});

app.post('/api/notifications', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), async (req, res) => {
    const { title, message, type } = req.body;
    try {
        const notif = await prisma.notification.create({
            data: {
                title,
                message,
                type: type || 'INFO',
                date: new Date()
            }
        });
        res.json(notif);
    } catch (e) {
        res.status(500).json({ error: "Failed to create announcement" });
    }
});


// --- ANALYTICS ROUTES ---
// ADMIN or OWNER (Strict operational data)
app.get('/api/analytics', authenticateToken, authorize(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        // 1. Weekly Revenue (Last 7 days)
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);

        const payments = await prisma.payment.findMany({
            where: { date: { gte: lastWeek } }
        });

        const revenueByDay = {}; // { 'Mon': 120, 'Tue': 300 }
        payments.forEach(p => {
            const day = new Date(p.date).toLocaleDateString('en-US', { weekday: 'short' });
            revenueByDay[day] = (revenueByDay[day] || 0) + p.amount;
        });

        // 2. Member Distribution
        const members = await prisma.member.findMany({ include: { plan: true } });
        const planDist = {};
        members.forEach(m => {
            const planName = m.plan?.name || 'Unknown';
            planDist[planName] = (planDist[planName] || 0) + 1;
        });

        // 3. Peak Hours (from Access Logs)
        const logs = await prisma.accessLog.findMany();
        const hoursDist = new Array(24).fill(0);
        logs.forEach(l => {
            const hour = new Date(l.checkIn).getHours(); // Fixed typo checkInTime -> checkIn
            hoursDist[hour]++;
        });

        // Simplify hours for chart (every 3 hours)
        const simpleHours = [
            hoursDist[6] + hoursDist[7] + hoursDist[8], // 6AM-9AM
            hoursDist[9] + hoursDist[10] + hoursDist[11], // 9AM-12PM
            hoursDist[12] + hoursDist[13] + hoursDist[14], // 12PM-3PM
            hoursDist[15] + hoursDist[16] + hoursDist[17], // 3PM-6PM
            hoursDist[18] + hoursDist[19] + hoursDist[20], // 6PM-9PM
            hoursDist[21] + hoursDist[22] + hoursDist[23]  // 9PM-12AM
        ];

        res.json({
            revenue: revenueByDay,
            plans: planDist,
            peakHours: simpleHours
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Seed Initial Data Route (Dev only)
app.post('/api/seed', async (req, res) => {
    try {
        // 1. Clean (Delete in order of dependencies)
        await prisma.accessLog.deleteMany({});
        await prisma.payment.deleteMany({});
        await prisma.member.deleteMany({}); // Members depend on Plans
        await prisma.class.deleteMany({});
        await prisma.plan.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.trainer.deleteMany({});
        await prisma.notification.deleteMany({});
        await prisma.loyaltyReward.deleteMany({});

        // 2. Plans
        await prisma.plan.createMany({
            data: [
                { name: 'Yearly Pro', price: 20.00, duration: 365 },
                { name: 'Monthly Standard', price: 10.00, duration: 30 },
                { name: 'Student Monthly', price: 8.00, duration: 30 },
                { name: 'Day Pass', price: 5.00, duration: 1 }
            ]
        });

        // 3. Products
        await prisma.product.createMany({
            data: [
                { name: 'Whey Protein Isolate - Chocolate', category: 'SUPPLEMENT', price: 59.99, stock: 45, minStock: 10, imageUrl: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&q=80&w=300' },
                { name: 'Pre-Workout - Blue Raz', category: 'SUPPLEMENT', price: 39.99, stock: 20, minStock: 5, imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&q=80&w=300' },
                { name: 'Gym Shark Water Bottle', category: 'MERCH', price: 25.00, stock: 15, minStock: 5, imageUrl: 'https://plus.unsplash.com/premium_photo-1661601662709-6d601d3680d2?q=80&w=300&auto=format&fit=crop' },
                { name: 'Energy Drink - Zero Sugar', category: 'DRINK', price: 3.50, stock: 8, minStock: 10, imageUrl: 'https://images.unsplash.com/photo-1622543925258-d63b58024c3f?q=80&w=300&auto=format&fit=crop' },
                { name: 'Protein Bar - Peanut Butter', category: 'SUPPLEMENT', price: 3.00, stock: 100, minStock: 20, imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=300&auto=format&fit=crop' },
                { name: 'Lifting Straps', category: 'EQUIPMENT', price: 15.00, stock: 30, minStock: 5, imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=300&auto=format&fit=crop' }
            ]
        });

        // 4. Trainers
        const trainer1 = await prisma.trainer.create({
            data: { name: 'Alex Johnson', specialty: 'Bodybuilding', bio: 'IFBB Pro with 10 years experience.', imageUrl: 'https://images.unsplash.com/photo-1567013127542-490d75785b9c?auto=format&fit=crop&q=80&w=200' }
        });
        const trainer2 = await prisma.trainer.create({
            data: { name: 'Sarah Connor', specialty: 'CrossFit & HIIT', bio: 'High energy functional training expert.', imageUrl: 'https://images.unsplash.com/photo-1611672585731-fa10603fb9e0?auto=format&fit=crop&q=80&w=200' }
        });
        const trainer3 = await prisma.trainer.create({
            data: { name: 'Mike Tyson (Coach)', specialty: 'Boxing', bio: 'Legendary boxing fundamentals.', imageUrl: 'https://images.unsplash.com/photo-1549476464-37392f717541?auto=format&fit=crop&q=80&w=200' }
        });

        // 5. Classes
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

        // 6. Notifications
        await prisma.notification.createMany({
            data: [
                { title: 'System Maintenance', message: 'The system will be offline for maintenance on Sunday at 2 AM.', type: 'ALERT', date: new Date() },
                { title: 'New Supplement Shipment', message: 'Restocked Gold Standard Whey and Pre-workout.', type: 'INFO', date: new Date(Date.now() - 86400000) },
                { title: 'Holiday Hours', message: 'We will close early on July 4th at 4 PM.', type: 'INFO', date: new Date(Date.now() - 172800000) },
                { title: 'Promo: Refer a Friend', message: 'Get 1 month free when you refer a friend!', type: 'PROMO', date: new Date(Date.now() - 259200000) }
            ]
        });

        // 7. Members (Dummy Members)
        const plan = await prisma.plan.findFirst();
        await prisma.member.createMany({
            data: [
                { firstName: 'Bruce', lastName: 'Wayne', email: 'bruce@wayne.com', status: 'ACTIVE', planId: plan.id, points: 500, startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                { firstName: 'Clark', lastName: 'Kent', email: 'clark@dailyplanet.com', status: 'ACTIVE', planId: plan.id, points: 120, startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                { firstName: 'Diana', lastName: 'Prince', email: 'diana@amazon.com', status: 'ACTIVE', planId: plan.id, points: 350, startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                { firstName: 'Barry', lastName: 'Allen', email: 'barry@flash.com', status: 'EXPIRED', planId: plan.id, points: 0, startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }
            ]
        });

        // 8. Historical Payments (For Analytics)
        const members = await prisma.member.findMany();
        const paymentMethods = ['CARD', 'CASH', 'E-WALLET'];
        const paymentTypes = ['MEMBERSHIP', 'POS_SALE', 'SERVICE'];

        const pastPayments = [];
        for (let i = 0; i < 50; i++) {
            const randomMember = members[Math.floor(Math.random() * members.length)];
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Last 30 days

            pastPayments.push({
                amount: Math.floor(Math.random() * 100) + 10,
                type: paymentTypes[Math.floor(Math.random() * paymentTypes.length)],
                method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                memberId: randomMember.id,
                date: date,
                status: 'COMPLETED'
            });
        }
        await prisma.payment.createMany({ data: pastPayments });

        // 9. Access Logs (For Attendance)
        const accessLogs = [];
        for (let i = 0; i < 30; i++) {
            const randomMember = members[Math.floor(Math.random() * members.length)];
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Last 7 days
            date.setHours(Math.floor(Math.random() * 14) + 6); // 6 AM to 8 PM

            accessLogs.push({
                memberId: randomMember.id,
                checkIn: date,
                status: 'ALLOWED'
            });
        }
        await prisma.accessLog.createMany({ data: accessLogs });

        // 10. Loyalty Rewards
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
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    // Auto-seed if empty
    try {
        const userCount = await prisma.user.count();
        if (userCount === 0) {
            console.log("Seeding database...");

            // Seed Plans
            await prisma.plan.createMany({
                data: [
                    { name: 'Gold', price: 50, duration: 30 },
                    { name: 'Silver', price: 30, duration: 30 },
                    { name: 'Bronze', price: 20, duration: 30 },
                    { name: 'Day Pass', price: 15, duration: 1 }
                ]
            });

            // Seed Admin User
            const hashedPassword = await bcrypt.hash('password123', 10);
            await prisma.user.create({
                data: {
                    email: 'admin@gym.com',
                    password: hashedPassword,
                    name: 'Admin User',
                    role: 'ADMIN'
                }
            });
            console.log("Database seeded! Admin: admin@gym.com / password123");
        }
    } catch (e) {
        console.error("Seeding failed:", e);
    }
});

