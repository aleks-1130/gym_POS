const express = require('express');
const router = express.Router();
const memberController = require('./memberController');
const { authenticateToken } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, memberController.getPaymentMethods);
router.post('/', authenticateToken, memberController.addPaymentMethod);
router.delete('/:id', authenticateToken, memberController.deletePaymentMethod);

module.exports = router;
