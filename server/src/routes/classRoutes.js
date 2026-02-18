const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, classController.getAllClasses);
router.get('/:id/participants', authenticateToken, classController.getClassParticipants);
router.post('/', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), classController.createClass);
router.put('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), classController.updateClass);
router.delete('/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'TRAINER']), classController.deleteClass);

// Trainer Routes for Classes
router.post('/:id/complete', authenticateToken, authorize(['TRAINER', 'ADMIN', 'OWNER']), classController.completeClass);

module.exports = router;
