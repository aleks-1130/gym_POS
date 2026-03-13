const express = require('express');
const router = express.Router();
const notificationController = require('./notificationController');
const preferenceController = require('./preferenceController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, notificationController.getNotifications);
router.patch('/read-all', authenticateToken, notificationController.markAllAsRead);
router.patch('/:id/read', authenticateToken, notificationController.markAsRead);
router.post('/broadcast', authenticateToken, authorize(['ADMIN', 'OWNER']), notificationController.broadcastAnnouncement);
router.delete('/:id', authenticateToken, authorize(['ADMIN', 'OWNER']), notificationController.deleteNotification);

// Preferences
router.get('/preferences', authenticateToken, preferenceController.getPreferences);
router.patch('/preferences', authenticateToken, preferenceController.updatePreferences);

module.exports = router;
