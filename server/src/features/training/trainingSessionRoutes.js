const express = require('express');
const router = express.Router();
const trainingSessionController = require('./trainingSessionController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingSessionController.getAllSessions);
router.get('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), trainingSessionController.getSessionById);
router.get('/:id/material-candidates', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), trainingSessionController.getSessionMaterialCandidates);
router.post('/:id/complete', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), trainingSessionController.completeSession);
router.post('/:id/decline', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), trainingSessionController.cancelSession);

module.exports = router;
