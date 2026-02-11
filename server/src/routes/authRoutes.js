const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// All routes are prefixed with /api/auth in server.js
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/member-setup', authController.setupMemberPassword);

module.exports = router;
