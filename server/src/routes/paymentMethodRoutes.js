const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, paymentController.getPaymentMethods);
router.post('/', authenticateToken, paymentController.addPaymentMethod);
router.delete('/:id', authenticateToken, paymentController.deletePaymentMethod);

module.exports = router;
