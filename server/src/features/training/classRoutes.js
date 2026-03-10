const express = require('express');
const router = express.Router();
const classController = require('./classController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, classController.getAllClasses);
router.get('/:id/participants', authenticateToken, classController.getClassParticipants);
router.post('/', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), classController.createClass);
router.put('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), classController.updateClass);
router.delete('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), classController.deleteClass);

// Trainer Routes for Classes
router.post('/:id/start', authenticateToken, authorize(['TRAINER']), classController.startClassSession);
router.post('/:id/complete', authenticateToken, authorize(['TRAINER']), classController.completeClass);
router.post('/:id/complete-override', authenticateToken, authorize(['ADMIN', 'OWNER']), classController.overrideCompleteClass);

module.exports = router;
