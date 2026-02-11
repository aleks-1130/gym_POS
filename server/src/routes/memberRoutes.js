const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Only Staff/Admin can list all members
router.get('/', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.getMembers);

// Member Self-Service APIs
router.get('/classes', authenticateToken, memberController.getAvailableClasses);
router.post('/book', authenticateToken, memberController.bookClass); // Member type check inside controller
router.post('/cancel-booking', authenticateToken, memberController.cancelBooking);
router.post('/book-training', authenticateToken, authorize(['MEMBER']), memberController.bookTraining);
router.post('/book-training-cash', authenticateToken, authorize(['MEMBER']), memberController.bookTrainingCash);
router.get('/me/transactions', authenticateToken, authorize(['MEMBER']), paymentController.getMyTransactions);
router.get('/me/training-sessions', authenticateToken, authorize(['MEMBER']), memberController.getMyTrainingSessions);

// Member Profile & Payment Methods
router.get('/:id', authenticateToken, memberController.getMemberProfile);
router.get('/:id/payment-methods', authenticateToken, memberController.getPaymentMethods);
router.post('/:id/payment-methods', authenticateToken, memberController.addPaymentMethod);
router.patch('/:id/payment-methods/:methodId', authenticateToken, memberController.updatePaymentMethod);
router.delete('/:id/payment-methods/:methodId', authenticateToken, memberController.deletePaymentMethod);

// Member CRUD (Staff/Admin/Self)
router.post('/', authenticateToken, authorize(['ADMIN', 'STAFF']), memberController.createMember);
router.post('/:id/renew', authenticateToken, authorize(['ADMIN', 'STAFF']), memberController.renewMembership);
router.get('/:id/payments', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.getMemberPayments);
router.get('/:id/notes', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.getMemberNotes);
router.post('/:id/notes', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.addMemberNote);
router.post('/:id/status', authenticateToken, authorize(['ADMIN', 'STAFF']), memberController.updateMemberStatus);
router.put('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'MEMBER']), memberController.updateMember);
router.post('/:id/change-password', authenticateToken, authorize(['MEMBER']), memberController.changePassword);

module.exports = router;
