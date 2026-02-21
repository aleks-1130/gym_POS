const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/trainingController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.post('/book-training', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.bookTraining);
router.get('/training-sessions', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.getTrainingSessions);
router.get('/training-sessions/refund-exceptions', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.getRefundExceptionRequests);
router.post('/training-sessions/:id/refund-exception/resolve', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.resolveRefundException);
router.get('/training-sessions/trainer-change-requests', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.getTrainerChangeRequests);
router.post('/training-sessions/:id/trainer-change-request/resolve', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.resolveTrainerChangeRequest);
router.post('/training-sessions/:id/collect', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.collectSessionPayment);
router.post('/training-sessions/:id/decline', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.declineSessionBooking);

module.exports = router;
