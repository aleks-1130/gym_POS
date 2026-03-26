const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('./settingsController');
const { getFinancialInstitutions, updateFinancialInstitutions } = require('./financialInstitutionController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, authorize(['OWNER']), getSettings);
router.post('/', authenticateToken, authorize(['OWNER']), updateSettings);

router.get('/financial-institutions', authenticateToken, authorize(['OWNER']), getFinancialInstitutions);
router.post('/financial-institutions', authenticateToken, authorize(['OWNER']), updateFinancialInstitutions);

module.exports = router;
