const express = require('express');
const router = express.Router();
const trainingSessionController = require('../controllers/trainingSessionController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingSessionController.getAllSessions);
router.get('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), trainingSessionController.getSessionById);
router.post('/:id/complete', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), trainingSessionController.completeSession);

module.exports = router;
