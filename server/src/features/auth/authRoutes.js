const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

// All routes are prefixed with /api/auth in server.js
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/logout-all', authenticateToken, authController.logoutAllSessions);
router.post('/member-setup', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), authController.setupMemberPassword);
router.post('/activate', authController.activateAccount);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-token', authController.verifyToken);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
