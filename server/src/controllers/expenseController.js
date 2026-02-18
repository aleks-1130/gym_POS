const prisma = require('../config/prisma');
const { logAudit } = require('../services/auditService');

const getExpenses = async (req, res) => {
    try {
        const expenses = await prisma.expense.findMany({
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
            const targetUser = await prisma.user.findUnique({ where: { id: Number(req.body.staffId) } });
            if (targetUser && (targetUser.role === 'ADMIN' || targetUser.role === 'OWNER') && req.user.role !== 'OWNER') {
                return res.status(403).json({ error: "Only the Owner can pay Admin or Owner salaries." });
            }
        }
    }

    try {
        const expense = await prisma.expense.create({
            data: {
                title,
                amount: parseFloat(amount),
                category,
                date: date ? new Date(date) : new Date(),
                notes,
                recordedBy: req.user.id.toString(),
                trainerId: req.body.trainerId ? Number(req.body.trainerId) : null,
                staffId: req.body.staffId ? Number(req.body.staffId) : null
            }
        });
        await logAudit("CREATE_EXPENSE", req.user.id.toString(), `Expense: ${expense.title}`, `Recorded ${expense.amount} in ${expense.category}`);
        res.json(expense);
    } catch (e) {
        console.error("Create Expense Error:", e);
        res.status(500).json({ error: "Failed to create expense" });
    }
};

const deleteExpense = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.expense.delete({ where: { id: Number(id) } });
        await logAudit("DELETE_EXPENSE", req.user.id.toString(), `Expense ID: ${id}`, "Deleted expense record");
        res.json({ message: "Expense deleted" });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete expense" });
    }
};

module.exports = {
    getExpenses,
    createExpense,
    deleteExpense
};
