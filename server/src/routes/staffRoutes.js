const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/trainingController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.post('/book-training', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.bookTraining);
router.get('/training-sessions', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.getTrainingSessions);
router.post('/training-sessions/:id/collect', authenticateToken, authorize(['ADMIN', 'STAFF']), trainingController.collectSessionPayment);

module.exports = router;
