const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// All routes are prefixed with /api/auth in server.js
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/member-setup', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), authController.setupMemberPassword);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
