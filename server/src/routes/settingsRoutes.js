const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/', getSettings); // Public/Authenticated? Maybe just public for reports? Or protected. Reports need it.
router.post('/', authenticateToken, authorize(['OWNER']), updateSettings);

module.exports = router;
