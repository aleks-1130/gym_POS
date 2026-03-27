const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('./settingsController');
const { getFinancialInstitutions, updateFinancialInstitutions } = require('./financialInstitutionController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, authorize(['OWNER', 'ADMIN']), getSettings);
router.post('/', authenticateToken, authorize(['OWNER', 'ADMIN']), updateSettings);

router.get('/financial-institutions', authenticateToken, authorize(['OWNER', 'ADMIN']), getFinancialInstitutions);
router.post('/financial-institutions', authenticateToken, authorize(['OWNER', 'ADMIN']), updateFinancialInstitutions);

module.exports = router;
