const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

const getExpenses = async (req, res) => {
    try {
        const { tenantId, gymId } = req.user;
        const expenses = await prisma.expense.findMany({
            where: { 
                tenantId,
                gymId: Number(gymId)
            },
            orderBy: { date: 'desc' }
        });
        res.json(expenses);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch expenses" });
    }
};

const createExpense = async (req, res) => {
    const { title, amount, category, date, notes } = req.body;


    // Strict Payroll Permissions
    if (category === 'SALARY') {
        // 1. Prevent Admin from paying themselves
        if (req.body.staffId && Number(req.body.staffId) === req.user.id) {
            return res.status(403).json({ error: "You cannot pay your own salary." });
        }

        // 2. Prevent Admin from paying other Admins (Only Owner can)
        if (req.body.staffId) {
            const targetUser = await prisma.user.findFirst({ 
                where: { 
                    id: Number(req.body.staffId),
                    tenantId: req.user.tenantId
                } 
            });
            if (targetUser && (targetUser.role === 'ADMIN' || targetUser.role === 'OWNER') && req.user.role !== 'OWNER') {
                return res.status(403).json({ error: "Only the Owner can pay Admin or Owner salaries." });
            }
        }
    }

    try {
        const { tenantId, gymId } = req.user;
        const expense = await prisma.expense.create({
            data: {
                title,
                amount: parseFloat(amount),
                category,
                date: date ? new Date(date) : new Date(),
                notes,
                recordedBy: req.user.id.toString(),
                trainerId: req.body.trainerId ? Number(req.body.trainerId) : null,
                staffId: req.body.staffId ? Number(req.body.staffId) : null,
                gym: { connect: { id: Number(gymId) } },
                tenant: { connect: { id: Number(tenantId) } }
            }
        });
        await logAudit("CREATE_EXPENSE", req.user.email, `Expense: ${expense.title}`, `Recorded ${expense.amount} in ${expense.category}`, gymId, tenantId);
        res.json(expense);
    } catch (e) {
        console.error("Create Expense Error:", e);
        res.status(500).json({ error: "Failed to create expense" });
    }
};

const updateExpense = async (req, res) => {
    const { id } = req.params;
    const { title, amount, category, date, notes } = req.body;
    try {
        const { tenantId, gymId } = req.user;
        const expense = await prisma.expense.updateMany({
            where: { id: Number(id), tenantId, gymId: Number(gymId) },
            data: {
                title,
                amount: parseFloat(amount),
                category,
                date: date ? new Date(date) : undefined,
                notes
            }
        });
        if (expense.count === 0) return res.status(404).json({ error: "Expense not found" });
        
        await logAudit("UPDATE_EXPENSE", req.user.email, `Expense ID: ${id}`, `Updated details`, req.user.gymId, req.user.tenantId);
        res.json({ message: "Expense updated" });
    } catch (e) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: "Expense not found" });
        }
        console.error("Update Expense Error:", e);
        res.status(500).json({ error: "Failed to update expense" });
    }
};

const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId, gymId } = req.user;
        const deleted = await prisma.expense.deleteMany({ 
            where: { id: Number(id), tenantId, gymId: Number(gymId) } 
        });
        if (deleted.count === 0) return res.status(404).json({ error: "Expense not found" });

        await logAudit("DELETE_EXPENSE", req.user.email, `Expense ID: ${id}`, "Deleted expense record", req.user.gymId, req.user.tenantId);
        res.json({ message: "Expense deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete expense" });
    }
};

module.exports = {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense
};
