const express = require('express');
const router = express.Router();
const promoController = require('./promoController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), promoController.getPromoCodes);
router.post('/', authenticateToken, authorize(['OWNER', 'ADMIN']), promoController.createPromoCode);
router.put('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), promoController.updatePromoCode);
router.delete('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), promoController.deletePromoCode);

module.exports = router;
