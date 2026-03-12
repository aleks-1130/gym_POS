const express = require('express');
const router = express.Router();
const notificationController = require('./notificationController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, notificationController.getNotifications);
router.patch('/:id/read', authenticateToken, notificationController.markAsRead);
router.post('/broadcast', authenticateToken, authorize(['ADMIN', 'OWNER']), notificationController.broadcastAnnouncement);
router.delete('/:id', authenticateToken, authorize(['ADMIN', 'OWNER']), notificationController.deleteNotification);

module.exports = router;
