const express = require('express');
const router = express.Router();
const expenseController = require('./expenseController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, expenseController.getExpenses);
router.post('/', authenticateToken, authorize(['OWNER', 'ADMIN']), expenseController.createExpense);
router.put('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), expenseController.updateExpense);
router.delete('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), expenseController.deleteExpense);

module.exports = router;
