const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

// All routes are prefixed with /api/auth in server.js
router.post('/login', authController.login);
router.post('/member-setup', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), authController.setupMemberPassword);
router.post('/activate', authController.activateAccount);
router.get('/verify-token', authController.verifyToken);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
