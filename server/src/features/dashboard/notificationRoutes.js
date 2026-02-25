const express = require('express');
const router = express.Router();
const notificationController = require('./notificationController');
const { authenticateToken } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, notificationController.getNotifications);

module.exports = router;
