const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('./settingsController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, getSettings); // Authenticated for security
router.post('/', authenticateToken, authorize(['OWNER']), updateSettings);

module.exports = router;
