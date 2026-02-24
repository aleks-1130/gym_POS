const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// POS Settings (Must be before /:id)
router.get('/settings', authenticateToken, authorize(['OWNER', 'ADMIN']), paymentController.getPosSettings);
router.post('/settings', authenticateToken, authorize(['OWNER', 'ADMIN']), paymentController.updatePosSettings);
router.get('/receipt-settings', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.getPosReceiptSettings);

// POS Payments
router.post('/', authenticateToken, authorize(['ADMIN', 'STAFF', 'MEMBER']), paymentController.createPayment);
router.get('/', authenticateToken, paymentController.getAllPayments);
router.get('/refunds', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.getRefunds);

// Specific Payment Actions
router.get('/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.getPaymentDetails);
router.post('/:id/collect-cash', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.collectPendingCashPayment);
router.post('/:id/decline-cash', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.declinePendingCashPayment);
router.post('/:id/return-items', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.returnPaymentItems);
router.post('/:id/void', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.voidPayment);
router.post('/:id/complete', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), paymentController.completePayment);

module.exports = router;
