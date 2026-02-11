const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.post('/checkin', authenticateToken, authorize(['ADMIN', 'STAFF']), accessController.checkIn);
router.get('/logs', authenticateToken, authorize(['ADMIN', 'STAFF', 'OWNER']), accessController.getAccessLogs);
router.get('/traffic', authenticateToken, authorize(['ADMIN', 'STAFF', 'OWNER']), accessController.getTrafficStats);
router.get('/logs/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'OWNER']), accessController.getAccessLogDetails);
router.post('/simulate', authenticateToken, authorize(['ADMIN', 'OWNER']), accessController.simulateAccess);

module.exports = router;
