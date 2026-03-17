const express = require('express');
const router = express.Router();
const accessController = require('./accessController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.post('/checkin', authenticateToken, authorize(['ADMIN', 'STAFF']), accessController.checkIn);
router.get('/qr-token', authenticateToken, authorize(['MEMBER', 'TRAINER']), accessController.getDynamicQrToken);
router.get('/latest-event', authenticateToken, authorize(['ADMIN', 'STAFF', 'OWNER']), accessController.getLatestAccessEvent);
router.get('/logs', authenticateToken, authorize(['ADMIN', 'STAFF', 'OWNER', 'MEMBER', 'TRAINER']), accessController.getAccessLogs);
router.get('/traffic', authenticateToken, authorize(['ADMIN', 'STAFF', 'OWNER', 'MEMBER', 'TRAINER']), accessController.getTrafficStats);
router.get('/logs/:id', authenticateToken, authorize(['ADMIN', 'STAFF', 'OWNER']), accessController.getAccessLogDetails);
router.post('/simulate', authenticateToken, authorize(['ADMIN', 'OWNER']), accessController.simulateAccess);

module.exports = router;
