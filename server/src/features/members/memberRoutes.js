const express = require('express');
const router = express.Router();
const memberController = require('./memberController');
const paymentController = require('../pos/paymentController');
const trainingSessionController = require('../training/trainingSessionController');
const loyaltyController = require('../pos/loyaltyController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

// Only Staff/Admin can list all members
router.get('/', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.getMembers);

// Member Self-Service APIs
router.get('/classes', authenticateToken, memberController.getAvailableClasses);
router.post('/book', authenticateToken, memberController.bookClass); // Member type check inside controller
router.post('/cancel-booking', authenticateToken, memberController.cancelBooking);
router.post('/book-training', authenticateToken, authorize(['MEMBER']), memberController.bookTraining);
router.post('/book-training-cash', authenticateToken, authorize(['MEMBER']), memberController.bookTrainingCash);
router.get('/me/transactions', authenticateToken, authorize(['MEMBER']), paymentController.getMyTransactions);
router.post('/me/training-sessions/:id/cancel', authenticateToken, authorize(['MEMBER']), trainingSessionController.cancelSession);
router.post('/me/training-sessions/:id/reschedule', authenticateToken, authorize(['MEMBER']), trainingSessionController.memberRescheduleSession);
router.post('/me/training-sessions/:id/rate', authenticateToken, authorize(['MEMBER']), memberController.rateTrainingSession);
router.get('/me/training-sessions', authenticateToken, authorize(['MEMBER']), memberController.getMyTrainingSessions);
router.get('/me/class-bookings', authenticateToken, authorize(['MEMBER']), memberController.getMyClassBookings);

// Member Profile & Payment Methods
router.get('/:id', authenticateToken, memberController.getMemberProfile);
router.get('/:id/payment-methods', authenticateToken, memberController.getPaymentMethods);
router.post('/:id/payment-methods', authenticateToken, memberController.addPaymentMethod);
router.patch('/:id/payment-methods/:methodId', authenticateToken, memberController.updatePaymentMethod);
router.delete('/:id/payment-methods/:methodId', authenticateToken, memberController.deletePaymentMethod);

// Member CRUD (Staff/Admin/Self)
router.post('/', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.createMember);
router.post('/:id/renew', authenticateToken, authorize(['OWNER', 'ADMIN']), memberController.renewMembership);
router.post('/:id/class-session-packages', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.purchaseClassSessionPackage);
router.get('/:id/payments', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.getMemberPayments);
router.get('/:id/notes', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.getMemberNotes);
router.post('/:id/notes', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.addMemberNote);
router.post('/:id/status', authenticateToken, authorize(['OWNER', 'ADMIN']), memberController.updateMemberStatus);
router.put('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'MEMBER']), memberController.updateMember);
router.delete('/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), memberController.deleteMember);
router.post('/:id/change-password', authenticateToken, authorize(['MEMBER']), memberController.changePassword);

// Member Loyalty
router.post('/:id/points', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF', 'MEMBER']), loyaltyController.managePoints);
router.get('/:id/loyalty-history', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF', 'MEMBER']), loyaltyController.getHistory);

module.exports = router;
