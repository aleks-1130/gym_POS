const express = require('express');
const router = express.Router();
const trainerController = require('./trainerController');
const trainingSessionController = require('./trainingSessionController');
const classController = require('./classController');
const trainerChangeRequestController = require('./trainerChangeRequestController');
const { authenticateToken, authorize, authorizeTrainerLinkedAccount } = require('../../middleware/authMiddleware');

// Trainer Self-Service
router.get('/me', authenticateToken, authorizeTrainerLinkedAccount, trainerController.getMe);
router.get('/me/commissions', authenticateToken, authorizeTrainerLinkedAccount, trainerController.getMyCommissions);
router.patch('/me/profile', authenticateToken, authorizeTrainerLinkedAccount, trainerController.updateMyProfileCredentials);
router.patch('/me/availability', authenticateToken, authorizeTrainerLinkedAccount, trainerController.updateMyAvailability);
router.get('/me/sessions', authenticateToken, authorizeTrainerLinkedAccount, trainingSessionController.getMySessions);
router.post('/me/sessions/:id/complete', authenticateToken, authorizeTrainerLinkedAccount, trainingSessionController.completeSession);
router.post('/me/sessions/:id/cancel', authenticateToken, authorizeTrainerLinkedAccount, trainingSessionController.cancelSession);
router.patch('/me/sessions/:id', authenticateToken, authorizeTrainerLinkedAccount, trainingSessionController.updateSession);
router.post('/me/sessions/:id/no-show', authenticateToken, authorizeTrainerLinkedAccount, trainingSessionController.markNoShow);
router.post('/me/sessions/:id/refund-exception', authenticateToken, authorizeTrainerLinkedAccount, trainingSessionController.requestRefundException);
router.post('/me/sessions/:id/unable-to-attend', authenticateToken, authorizeTrainerLinkedAccount, trainingSessionController.requestUnableToAttend);

router.get('/me/classes', authenticateToken, authorizeTrainerLinkedAccount, classController.getAllClasses);
router.get('/me/classes/history', authenticateToken, authorizeTrainerLinkedAccount, classController.getMyClassHistory);
router.post('/me/classes/:id/start', authenticateToken, authorizeTrainerLinkedAccount, classController.startClassSession);
router.post('/me/classes/:id/complete', authenticateToken, authorizeTrainerLinkedAccount, classController.completeClass);
router.patch('/me/classes/:classId/attendees/:bookingId', authenticateToken, authorizeTrainerLinkedAccount, classController.updateAttendeeStatus);
router.get('/me/profile-change-requests', authenticateToken, authorizeTrainerLinkedAccount, trainerChangeRequestController.getMyProfileChangeRequests);
router.post('/me/profile-change-requests', authenticateToken, authorizeTrainerLinkedAccount, trainerChangeRequestController.createMyProfileChangeRequest);

// Trainer profile/status change approvals
router.get('/change-requests', authenticateToken, authorize(['ADMIN']), trainerChangeRequestController.listChangeRequests);
router.post('/change-requests/:id/admin-review', authenticateToken, authorize(['ADMIN']), trainerChangeRequestController.reviewByAdmin);

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
