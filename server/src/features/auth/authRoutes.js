const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');
const { authLimiter } = require('../../middleware/rateLimiter');

// All routes are prefixed with /api/auth in server.js
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/logout-all', authenticateToken, authController.logoutAllSessions);
router.post('/member-setup', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), authController.setupMemberPassword);
router.post('/activate', authLimiter, authController.activateAccount);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/verify-token', authController.verifyToken);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
