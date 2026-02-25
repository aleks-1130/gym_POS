const express = require('express');
const router = express.Router();
const trainerController = require('./trainerController');
const trainingSessionController = require('./trainingSessionController');
const classController = require('./classController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

// Trainer Self-Service
router.get('/me', authenticateToken, authorize(['TRAINER']), trainerController.getMe);
router.get('/me/commissions', authenticateToken, authorize(['TRAINER']), trainerController.getMyCommissions);
router.get('/me/sessions', authenticateToken, authorize(['TRAINER']), trainingSessionController.getMySessions);
router.post('/me/sessions/:id/complete', authenticateToken, authorize(['TRAINER']), trainingSessionController.completeSession);
router.post('/me/sessions/:id/cancel', authenticateToken, authorize(['TRAINER']), trainingSessionController.cancelSession);
router.patch('/me/sessions/:id', authenticateToken, authorize(['TRAINER']), trainingSessionController.updateSession);
router.post('/me/sessions/:id/no-show', authenticateToken, authorize(['TRAINER']), trainingSessionController.markNoShow);
router.post('/me/sessions/:id/refund-exception', authenticateToken, authorize(['TRAINER']), trainingSessionController.requestRefundException);
router.post('/me/sessions/:id/unable-to-attend', authenticateToken, authorize(['TRAINER']), trainingSessionController.requestUnableToAttend);

router.get('/me/classes', authenticateToken, authorize(['TRAINER']), classController.getAllClasses);
router.patch('/me/classes/:classId/attendees/:bookingId', authenticateToken, authorize(['TRAINER']), classController.updateAttendeeStatus);

// Public / Member Views
router.get('/', authenticateToken, trainerController.getAllTrainers);
router.get('/:id', authenticateToken, trainerController.getTrainerById);
router.get('/:id/sessions', authenticateToken, trainingSessionController.getTrainerSessions);

// Admin CRUD
router.post('/', authenticateToken, authorize(['OWNER', 'ADMIN']), trainerController.createTrainer);
router.put('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), trainerController.updateTrainer);
router.delete('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), trainerController.deleteTrainer);
router.post('/:id/create-login', authenticateToken, authorize(['OWNER', 'ADMIN']), trainerController.createTrainerLogin);

module.exports = router;
