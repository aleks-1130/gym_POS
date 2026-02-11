const express = require('express');
const router = express.Router();
const trainerController = require('../controllers/trainerController');
const trainingSessionController = require('../controllers/trainingSessionController');
const classController = require('../controllers/classController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Trainer Self-Service
router.get('/me', authenticateToken, authorize(['TRAINER']), trainerController.getMe);
router.get('/me/sessions', authenticateToken, authorize(['TRAINER']), trainingSessionController.getMySessions);
router.post('/me/sessions/:id/complete', authenticateToken, authorize(['TRAINER']), trainingSessionController.completeSession);
router.patch('/me/sessions/:id', authenticateToken, authorize(['TRAINER']), trainingSessionController.updateSession);

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
