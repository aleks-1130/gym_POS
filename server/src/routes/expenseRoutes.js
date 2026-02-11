const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, expenseController.getExpenses);
router.post('/', authenticateToken, authorize(['OWNER', 'ADMIN']), expenseController.createExpense);
router.delete('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), expenseController.deleteExpense);

module.exports = router;
